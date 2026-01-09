import { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000';

function App() {
  const [token, setToken] = useState('');
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
  });

  const [tasks, setTasks] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    category: 'Plantation',
    points: 10,
    expectedLabels: 'tree,plant',
  });

  // NEW: admin submissions + tab
  const [submissions, setSubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'adminSubmissions'

  const authHeaders = () =>
    token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {};

  useEffect(() => {
    if (token) {
      loadTasks();
      loadLeaderboard();
      if (role === 'admin') {
        loadSubmissions();
      }
    }
  }, [token, role]);

  async function loadTasks() {
    try {
      const res = await axios.get(`${API}/api/tasks`, {
        headers: authHeaders(),
      });
      setTasks(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadLeaderboard() {
    try {
      const res = await axios.get(`${API}/api/leaderboard`, {
        headers: authHeaders(),
      });
      setLeaderboard(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadSubmissions() {
    try {
      const res = await axios.get(`${API}/api/submissions`, {
        headers: authHeaders(),
      });
      setSubmissions(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function updateSubmissionStatus(id, status) {
    try {
      await axios.patch(
        `${API}/api/submissions/${id}`,
        { status },
        { headers: authHeaders() }
      );
      alert(`Submission ${status}.`);
      loadSubmissions();
      loadLeaderboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating submission');
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    try {
      if (authMode === 'register') {
        await axios.post(`${API}/api/auth/register`, {
          name: authForm.name,
          email: authForm.email,
          password: authForm.password,
          role: authForm.role,
        });
        alert('Registered successfully. Please login.');
        setAuthMode('login');
      } else {
        const res = await axios.post(`${API}/api/auth/login`, {
          email: authForm.email,
          password: authForm.password,
        });
        setToken(res.data.token);
        setRole(res.data.role);
        setName(res.data.name);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Authentication error');
    }
  }

  async function handleSubmitProof(task) {
    if (!imageFile) {
      alert('Please select an image file.');
      return;
    }
    const fd = new FormData();
    fd.append('image', imageFile);

    try {
      await axios.post(`${API}/api/submissions/${task._id}`, fd, {
        headers: {
          ...authHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      });
      alert('Submission uploaded!');
      setSelectedTask(null);
      setImageFile(null);
      loadLeaderboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Error uploading proof');
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    try {
      await axios.post(
        `${API}/api/tasks`,
        {
          title: taskForm.title,
          description: taskForm.description,
          category: taskForm.category,
          points: Number(taskForm.points),
          expectedLabels: taskForm.expectedLabels
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
        { headers: authHeaders() }
      );
      alert('Task created.');
      setTaskForm({
        title: '',
        description: '',
        category: 'Plantation',
        points: 10,
        expectedLabels: 'tree,plant',
      });
      loadTasks();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating task');
    }
  }

  function handleLogout() {
    setToken('');
    setRole('');
    setName('');
    setTasks([]);
    setLeaderboard([]);
    setSubmissions([]);
    setActiveTab('dashboard');
  }

  const isAdmin = role === 'admin';

  // ------------------ AUTH SCREEN ------------------
  if (!token) {
    return (
      <div className="app-shell">
        <div className="navbar">
          <div className="navbar-title">EcoGamify Platform</div>
        </div>
        <div className="main-content">
          <div className="auth-card">
            <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              {authMode === 'login'
                ? 'Enter your credentials to access the platform.'
                : 'Create an account as student or admin.'}
            </p>
            <form onSubmit={handleAuth}>
              {authMode === 'register' && (
                <>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      value={authForm.name}
                      onChange={(e) =>
                        setAuthForm({ ...authForm, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <select
                      value={authForm.role}
                      onChange={(e) =>
                        setAuthForm({ ...authForm, role: e.target.value })
                      }
                    >
                      <option value="student">Student</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </>
              )}
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, password: e.target.value })
                  }
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                {authMode === 'login' ? 'Login' : 'Register'}
              </button>
            </form>
            <div style={{ marginTop: 10, fontSize: 13 }}>
              {authMode === 'login' ? (
                <>
                  New user?{' '}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAuthMode('register')}
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAuthMode('login')}
                  >
                    Login
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------------------ LOGGED-IN UI ------------------
  return (
    <div className="app-shell">
      <div className="navbar">
        <div className="navbar-title">EcoGamify Platform</div>
        <div className="navbar-user">
          Signed in as <strong>{name}</strong> ({role}){' '}
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="main-content">
        {isAdmin && (
          <div style={{ marginBottom: 12 }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginRight: 8 }}
              onClick={() => setActiveTab('dashboard')}
            >
              Student View
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setActiveTab('adminSubmissions');
                loadSubmissions();
              }}
            >
              Admin Submissions
            </button>
          </div>
        )}

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <>
            <div className="dashboard-grid">
              {/* LEFT: Active tasks */}
              <div className="card">
                <h3>Active Eco Tasks</h3>
                <p style={{ fontSize: 13, marginBottom: 10 }}>
                  Complete these tasks in real life, upload a photo, and earn
                  points.
                </p>

                {tasks.length === 0 && (
                  <p style={{ fontSize: 13 }}>No tasks created yet.</p>
                )}

                {tasks.map((t) => (
                  <div key={t._id} className="task-item">
                    <div className="task-item-header">
                      <div>
                        <strong>{t.title}</strong>{' '}
                        <span className="tag">{t.category}</span>
                      </div>
                      <div style={{ fontSize: 13 }}>{t.points} pts</div>
                    </div>
                    <p style={{ fontSize: 13, marginTop: 4 }}>
                      {t.description}
                    </p>
                    {!isAdmin && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 6 }}
                        onClick={() => setSelectedTask(t)}
                      >
                        Submit Proof
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* RIGHT: Leaderboard */}
              <div className="card">
                <h3>Leaderboard</h3>
                <p style={{ fontSize: 13, marginBottom: 8 }}>
                  Top students based on approved eco activities.
                </p>
                <ol className="leaderboard-list">
                  {leaderboard.map((u, index) => (
                    <li key={u._id}>
                      #{index + 1} {u.name} - <strong>{u.points}</strong> pts
                      {u.badges?.map((b) => (
                        <span key={b} className="badge">
                          {b}
                        </span>
                      ))}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* ADMIN: create task */}
            {isAdmin && (
              <div style={{ marginTop: 24 }}>
                <div className="card">
                  <h3>Create New Task</h3>
                  <form onSubmit={handleCreateTask}>
                    <div className="form-group">
                      <label>Title</label>
                      <input
                        value={taskForm.title}
                        onChange={(e) =>
                          setTaskForm({ ...taskForm, title: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <input
                        value={taskForm.description}
                        onChange={(e) =>
                          setTaskForm({
                            ...taskForm,
                            description: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <select
                        value={taskForm.category}
                        onChange={(e) =>
                          setTaskForm({
                            ...taskForm,
                            category: e.target.value,
                          })
                        }
                      >
                        <option>Plantation</option>
                        <option>Waste Management</option>
                        <option>Energy Saving</option>
                        <option>Awareness Campaign</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Points</label>
                      <input
                        type="number"
                        min="1"
                        value={taskForm.points}
                        onChange={(e) =>
                          setTaskForm({
                            ...taskForm,
                            points: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Expected Labels (for AI)</label>
                      <input
                        value={taskForm.expectedLabels}
                        onChange={(e) =>
                          setTaskForm({
                            ...taskForm,
                            expectedLabels: e.target.value,
                          })
                        }
                        placeholder="tree,plant"
                      />
                      <span style={{ fontSize: 11 }}>
                        Comma-separated words that should appear in the photo
                        labels.
                      </span>
                    </div>
                    <button className="btn btn-primary" type="submit">
                      Save Task
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* ADMIN SUBMISSIONS TAB */}
        {isAdmin && activeTab === 'adminSubmissions' && (
          <div className="card">
            <h3>Submissions (AI Score + Review)</h3>
            <p style={{ fontSize: 13, marginBottom: 10 }}>
              AI gives an initial score; you can confirm or override the result.
            </p>
            {submissions.length === 0 && (
              <p style={{ fontSize: 13 }}>No submissions yet.</p>
            )}
            {submissions.map((s) => (
              <div
                key={s._id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 8,
                  fontSize: 13,
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <div>
                    <strong>{s.task?.title}</strong>{' '}
                    <span className="tag">Status: {s.status}</span>
                  </div>
                  <div>
                    AI Score: <strong>{s.aiScore}</strong>/100
                  </div>
                </div>
                <div style={{ marginTop: 4 }}>
                  Student: {s.student?.name} ({s.student?.email})
                </div>
                <div style={{ marginTop: 4 }}>
                  Labels: {s.labels && s.labels.join(', ')}
                </div>
                <div style={{ marginTop: 6 }}>
                  <a
                    href={`${API}${s.imageUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ marginRight: 10 }}
                  >
                    View Image
                  </a>
                  {s.status !== 'approved' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        updateSubmissionStatus(s._id, 'approved')
                      }
                    >
                      Approve
                    </button>
                  )}
                  {s.status !== 'rejected' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginLeft: 6 }}
                      onClick={() =>
                        updateSubmissionStatus(s._id, 'rejected')
                      }
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal for student submission */}
        {selectedTask && (
          <div
            className="modal-backdrop"
            onClick={() => setSelectedTask(null)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Submit Proof</h3>
              <p style={{ fontSize: 13 }}>
                Task: <strong>{selectedTask.title}</strong> (
                {selectedTask.points} pts)
              </p>
              <p style={{ fontSize: 13 }}>{selectedTask.description}</p>
              <div className="file-input">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files[0])}
                />
              </div>
              <div style={{ textAlign: 'right' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedTask(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSubmitProof(selectedTask)}
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
