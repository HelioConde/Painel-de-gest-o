const STORAGE_KEY = 'poster-jobs:v1'

function readJobs() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeJobs(jobs) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, 100)))
  return jobs
}

export function listPosterJobs() {
  return readJobs().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export function savePosterJob(job) {
  const now = new Date().toISOString()
  const id = job.id || `poster-job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const next = {
    ...job,
    id,
    createdAt: job.createdAt || now,
    updatedAt: now,
  }
  const jobs = readJobs()
  const index = jobs.findIndex((item) => item.id === id)
  if (index >= 0) jobs[index] = next
  else jobs.unshift(next)
  writeJobs(jobs)
  return next
}

export function deletePosterJob(id) {
  return writeJobs(readJobs().filter((job) => job.id !== id))
}
