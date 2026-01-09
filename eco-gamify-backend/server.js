require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
// Optional: enable real Google Vision later
// const vision = require('@google-cloud/vision');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ====== MongoDB connection ======
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/eco_gamify')
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('Mongo error', err));

// ====== Schemas & Models ======
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  points: { type: Number, default: 0 },
  badges: [{ type: String }]
});

const taskSchema = new mongoose.Schema({
  title: String,
  description: String,
  category: String,
  points: Number,
  expectedLabels: [String], // e.g. ['tree','plant']
  deadline: Date,
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const submissionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  imageUrl: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  labels: [String],
  aiScore: { type: Number, default: 0 },   // <‑‑ added
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);
const Submission = mongoose.model('Submission', submissionSchema);

// ====== Auth middleware ======
const authMiddleware = (roles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token' });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
      req.user = decoded;
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
};

// ====== Multer setup for image upload ======
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ====== Auth routes ======
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User exists' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash: hash,
      role: role === 'admin' ? 'admin' : 'student'
    });
    res.json({ message: 'Registered', userId: user._id });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '7d' }
    );
    res.json({ token, role: user.role, name: user.name });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// ====== Task routes ======
app.post('/api/tasks', authMiddleware(['admin']), async (req, res) => {
  try {
    const { title, description, category, points, expectedLabels, deadline } = req.body;
    const task = await Task.create({
      title,
      description,
      category,
      points,
      expectedLabels,
      deadline,
      createdBy: req.user.id
    });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

app.get('/api/tasks', authMiddleware(), async (req, res) => {
  try {
    const tasks = await Task.find({ isActive: true });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// ====== Submission route with mock AI ======
// async function mockLabelDetection(filePath) {
//   // TODO: Replace with real Google Vision label detection
//   // This function returns dummy labels for development
//   return ['tree', 'plant', 'environment', 'person'];
// }


// async Vision-like mock with score
async function mockLabelDetectionWithScore(filePath, expectedLabels) {
  // later you can replace this with real Google Vision call
  const annotations = [
    { description: 'tree', score: 0.90 },
    { description: 'plant', score: 0.82 },
    { description: 'environment', score: 0.75 }
  ];

  const labels = annotations.map((a) => a.description);

  const expected = (expectedLabels || []).map((e) => e.toLowerCase());
  const matchedScores = annotations
    .filter((a) => expected.includes(a.description.toLowerCase()))
    .map((a) => a.score);

  let aiScore = 0;
  if (matchedScores.length > 0) {
    const avg = matchedScores.reduce((s, x) => s + x, 0) / matchedScores.length;
    aiScore = Math.round(avg * 100);
  }

  return { labels, aiScore };
}


app.post(
  '/api/submissions/:taskId',
  authMiddleware(['student']),
  upload.single('image'),
    async (req, res) => {
    try {
      const taskId = req.params.taskId;
      const task = await Task.findById(taskId);
      if (!task) return res.status(404).json({ message: 'Task not found' });

      const imageUrl = `/uploads/${req.file.filename}`;

      const { labels, aiScore } = await mockLabelDetectionWithScore(
        req.file.path,
        task.expectedLabels || []
      );

      let status = 'pending';
      const expected = (task.expectedLabels || []).map((e) => e.toLowerCase());
      const matched = labels.some((l) => expected.includes(l.toLowerCase()));

      if (matched && aiScore >= 60) {
        status = 'approved';
      }

      const submission = await Submission.create({
        student: req.user.id,
        task: taskId,
        imageUrl,
        status,
        labels,
        aiScore
      });

      if (status === 'approved') {
        const user = await User.findById(req.user.id);
        user.points += task.points;
        if (user.points >= 50 && !user.badges.includes('Green Beginner')) {
          user.badges.push('Green Beginner');
        }
        if (user.points >= 200 && !user.badges.includes('Eco Warrior')) {
          user.badges.push('Eco Warrior');
        }
        await user.save();
      }

      res.json(submission);
    } catch (err) {
      res.status(500).json({ message: 'Error', error: err.message });
    }
  }
);


// ====== Admin review routes ======
app.get('/api/submissions', authMiddleware(['admin']), async (req, res) => {
  try {
    const subs = await Submission.find()
      .populate('student', 'name email')
      .populate('task', 'title points');
    res.json(subs);
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

app.patch('/api/submissions/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    const sub = await Submission.findById(req.params.id).populate('task').populate('student');
    if (!sub) return res.status(404).json({ message: 'Not found' });

    if (sub.status !== 'approved' && status === 'approved') {
      const user = await User.findById(sub.student._id);
      user.points += sub.task.points;
      await user.save();
    }
    sub.status = status;
    await sub.save();
    res.json(sub);
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// ====== Leaderboard ======
app.get('/api/leaderboard', authMiddleware(), async (req, res) => {
  try {
    const users = await User.find({ role: 'student' })
      .sort({ points: -1 })
      .select('name points badges');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// ====== Seed sample tasks for demo (run once) ======
async function seedDemoTasks() {
  const count = await Task.countDocuments();
  if (count > 0) return; // do nothing if tasks already exist

  const demoTasks = [
    {
      title: 'Plant a Sapling',
      description: 'Plant a sapling in your home, hostel, or neighbourhood and water it regularly.',
      category: 'Plantation',
      points: 20,
      expectedLabels: ['tree', 'plant', 'garden']
    },
    {
      title: 'Clean Your Classroom Area',
      description: 'Collect litter around your classroom or lab and put it in the dustbin.',
      category: 'Waste Management',
      points: 15,
      expectedLabels: ['trash', 'litter', 'bin']
    },
    {
      title: 'Cycle or Walk to College',
      description: 'Use a bicycle or walk instead of a motorbike for at least one trip to college.',
      category: 'Energy Saving',
      points: 25,
      expectedLabels: ['bicycle', 'bike', 'cycle']
    }
  ];

  await Task.insertMany(demoTasks);
  console.log('Demo eco tasks inserted.');
}

seedDemoTasks().catch(console.error);


// ====== Start server ======
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
