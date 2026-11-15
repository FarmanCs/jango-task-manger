import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, ClipboardList,
  Clock3, Flame, LogOut, Plus, Sparkles, Target, Trash2,
} from 'lucide-react'

const today = new Date()
let csrfToken = ''
const localDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
      ...options.headers,
    },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Something went wrong.')
  if (path === '/api/auth/csrf/') csrfToken = data.csrfToken
  return data
}

function App() {
  const [user, setUser] = useState(null)
  const [selectedDate, setSelectedDate] = useState(localDate(today))
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadTasks = useCallback(async () => {
    const data = await request(`/api/tasks/?date=${selectedDate}`)
    setTasks(data.tasks)
  }, [selectedDate])

  useEffect(() => {
    async function initialize() {
      try {
        await request('/api/auth/csrf/')
        const { user: currentUser } = await request('/api/auth/me/')
        setUser(currentUser)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [])

  useEffect(() => {
    if (user) loadTasks().catch((err) => setError(err.message))
  }, [user, loadTasks])

  const completed = tasks.filter((task) => task.is_completed).length
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0
  const dateLabel = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    })
  }, [selectedDate])

  async function authenticate(credentials, isRegister) {
    setError('')
    try {
      const { csrfToken } = await request('/api/auth/csrf/')
      const { user: loggedInUser } = await request(
        `/api/auth/${isRegister ? 'register' : 'login'}/`,
        {
          method: 'POST',
          headers: { 'X-CSRFToken': csrfToken },
          body: JSON.stringify(credentials),
        },
      )
      await request('/api/auth/csrf/')
      setUser(loggedInUser)
    } catch (err) {
      setError(err.message)
    }
  }

  async function updateTask(task, changes) {
    setError('')
    try {
      const { task: updated } = await request(`/api/tasks/${task.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      })
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (err) {
      setError(err.message)
    }
  }

  async function addTask(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const title = form.get('title').trim()
    if (!title) return
    setError('')
    try {
      const { task } = await request('/api/tasks/', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: form.get('description').trim(),
          planned_date: selectedDate,
        }),
      })
      setTasks((current) => [...current, task])
      formElement.reset()
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteTask(task) {
    setError('')
    try {
      await request(`/api/tasks/${task.id}/`, { method: 'DELETE' })
      setTasks((current) => current.filter((item) => item.id !== task.id))
    } catch (err) {
      setError(err.message)
    }
  }

  async function signOut() {
    try {
      const { csrfToken } = await request('/api/auth/csrf/')
      await request('/api/auth/logout/', {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken },
      })
      setUser(null)
      setTasks([])
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="loading-screen"><span className="loader" />Loading your workspace</div>
  if (!user) return <AuthScreen onAuthenticate={authenticate} error={error} />

  const shiftDate = (days) => {
    const [year, month, day] = selectedDate.split('-').map(Number)
    const shifted = new Date(year, month - 1, day + days)
    setSelectedDate(localDate(shifted))
  }
  const firstName = user.email.split('@')[0]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-icon"><Check size={19} strokeWidth={3} /></span>taskmanger</a>
        <div className="side-label">WORKSPACE</div>
        <button className="nav-item active"><ClipboardList size={18} /> My tasks <span className="nav-count">{tasks.length}</span></button>
        <button className="nav-item" onClick={() => setSelectedDate(localDate(today))}><Clock3 size={18} /> Today</button>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon"><Sparkles size={16} /></div>
            <strong>Small steps add up.</strong>
            <span>Make today count, one task at a time.</span>
          </div>
          <button className="profile" onClick={signOut}>
            <span className="avatar">{firstName.slice(0, 1).toUpperCase()}</span>
            <span className="profile-text"><strong>{firstName}</strong><small>{user.email}</small></span>
            <LogOut size={17} className="logout-icon" />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar"><span className="breadcrumb">My workspace <span>/</span> My tasks</span><span className="date-stamp">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></header>
        <div className="dashboard">
          <div className="welcome-row">
            <div><p className="eyebrow">YOUR PERSONAL PLANNER</p><h1>A little progress<br className="mobile-break" /> goes a long way<span className="heading-period">.</span></h1><p className="subheading">A clear mind starts with a clear plan. What will you accomplish?</p></div>
            <div className="welcome-mark"><span>✳</span></div>
          </div>

          <section className="overview">
            <div className="overview-title"><div><p className="eyebrow">DAILY OVERVIEW</p><h2>{dateLabel}</h2></div><div className="date-controls"><button aria-label="Previous day" onClick={() => shiftDate(-1)}><ArrowLeft size={17} /></button><button aria-label="Next day" onClick={() => shiftDate(1)}><ArrowRight size={17} /></button></div></div>
            <div className="stats-grid">
              <div className="stat-card progress-card"><div className="stat-icon mint"><Target size={19} /></div><div className="stat-copy"><span>Daily progress</span><strong>{progress}<small>%</small></strong></div><div className="progress-ring" style={{ '--progress': `${progress}%` }}><span>{progress}%</span></div></div>
              <div className="stat-card"><div className="stat-icon lavender"><ClipboardList size={19} /></div><div className="stat-copy"><span>Tasks planned</span><strong>{tasks.length}<small> tasks</small></strong></div></div>
              <div className="stat-card"><div className="stat-icon peach"><CheckCircle2 size={19} /></div><div className="stat-copy"><span>Tasks completed</span><strong>{completed}<small> of {tasks.length}</small></strong></div></div>
            </div>
          </section>

          <section className="task-section">
            <div className="section-heading"><div><p className="eyebrow">MAKE IT HAPPEN</p><h2>Today’s focus <span className="task-total">{tasks.length}</span></h2></div><div className="focus-streak"><Flame size={16} /> One day at a time</div></div>
            {error && <div className="error-banner">{error}</div>}
            <form className="add-task" onSubmit={addTask}>
              <Plus size={19} />
              <input name="title" placeholder="Add a task you want to get done..." aria-label="Task title" maxLength="180" required />
              <input name="description" placeholder="Add a note (optional)" aria-label="Task note" />
              <button className="transition-colors duration-150" type="submit">Add task <Plus size={16} /></button>
            </form>
            <div className="task-list">
              {tasks.length === 0 ? <div className="empty-state"><div className="empty-icon"><ClipboardList size={24} /></div><strong>Your day is a blank page.</strong><span>Add a task above and start planning something great.</span></div> : tasks.map((task) => (
                <article className={`task-row ${task.is_completed ? 'is-done' : ''}`} key={task.id}>
                  <button className="check-button" aria-label={task.is_completed ? 'Mark task as not done' : 'Mark task as done'} onClick={() => updateTask(task, { is_completed: !task.is_completed })}>{task.is_completed ? <CheckCircle2 size={21} /> : <Circle size={21} />}</button>
                  <div className="task-copy"><strong>{task.title}</strong>{task.description && <span>{task.description}</span>}</div>
                  <span className={`task-status ${task.is_completed ? 'done' : ''}`}>{task.is_completed ? 'Completed' : 'To do'}</span>
                  <button className="delete-button" aria-label={`Delete ${task.title}`} onClick={() => deleteTask(task)}><Trash2 size={17} /></button>
                </article>
              ))}
            </div>
            {tasks.length > 0 && <div className="list-footer"><span>{completed === tasks.length ? 'Everything is done. Nice work!' : `${tasks.length - completed} ${tasks.length - completed === 1 ? 'task' : 'tasks'} left to go`}</span><span>{completed} / {tasks.length} complete</span></div>}
          </section>
          <footer className="footer-note"><Sparkles size={14} /> Progress, not perfection. You’ve got this.</footer>
        </div>
      </main>
    </div>
  )
}

function AuthScreen({ onAuthenticate, error }) {
  const [isRegister, setIsRegister] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    const form = new FormData(event.currentTarget)
    await onAuthenticate({ email: form.get('email'), password: form.get('password') }, isRegister)
    setSubmitting(false)
  }
  return (
    <main className="auth-page">
      <div className="auth-decoration decoration-one" /><div className="auth-decoration decoration-two" />
      <section className="auth-card">
        <a className="brand auth-brand" href="#"><span className="brand-icon"><Check size={19} strokeWidth={3} /></span>taskmanger</a>
        <p className="eyebrow">{isRegister ? 'A FRESH START' : 'YOUR DAY, WITH INTENTION'}</p>
        <h1>{isRegister ? 'Make room for what matters.' : 'Make today count.'}</h1>
        <p className="auth-subtitle">{isRegister ? 'Create your account and start planning one day at a time.' : 'Sign in to find your focus and make steady progress.'}</p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" placeholder="At least 8 characters" autoComplete={isRegister ? 'new-password' : 'current-password'} required />
          {error && <div className="error-banner">{error}</div>}
          <button className="transition-colors duration-150 disabled:cursor-not-allowed" type="submit" disabled={submitting}>{submitting ? 'One moment...' : isRegister ? 'Create your account' : 'Sign in'} <ArrowRight size={17} /></button>
        </form>
        <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to taskmanger?'} <button onClick={() => setIsRegister(!isRegister)}>{isRegister ? 'Sign in' : 'Create an account'}</button></p>
      </section>
      <div className="auth-caption"><span>✳</span> A calmer way to get things done.</div>
    </main>
  )
}

export default App
