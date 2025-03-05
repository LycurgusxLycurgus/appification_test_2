/**
 * TaskStorageService - Handles persistence of tasks and tokens
 * 
 * This service abstracts storage operations to make future migration to 
 * Supabase or SQL databases easier. Currently uses localStorage for offline persistence.
 */
export default class TaskStorageService {
  constructor() {
    this.storageKey = 'taskGame_tasks';
    this.tokenKey = 'taskGame_tokens';
    this._initializeStorage();
  }

  /**
   * Initialize storage if it doesn't exist
   * @private
   */
  _initializeStorage() {
    // Check if localStorage is available
    try {
      if (!localStorage.getItem(this.storageKey)) {
        localStorage.setItem(this.storageKey, JSON.stringify([]));
      }
      if (!localStorage.getItem(this.tokenKey)) {
        localStorage.setItem(this.tokenKey, JSON.stringify(0));
      }
    } catch (e) {
      console.error('Local storage is not available:', e);
    }
  }

  /**
   * Get all tasks from storage
   * @returns {Array} Array of task objects
   */
  getTasks() {
    try {
      const tasks = localStorage.getItem(this.storageKey);
      return tasks ? JSON.parse(tasks) : [];
    } catch (e) {
      console.error('Error retrieving tasks:', e);
      return [];
    }
  }

  /**
   * Save all tasks to storage
   * @param {Array} tasks Array of task objects
   * @returns {boolean} Success status
   */
  saveTasks(tasks) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(tasks));
      return true;
    } catch (e) {
      console.error('Error saving tasks:', e);
      return false;
    }
  }

  /**
   * Add a new task to storage
   * @param {Object} task Task object to add
   * @returns {boolean} Success status
   */
  addTask(task) {
    const tasks = this.getTasks();
    tasks.push(task);
    return this.saveTasks(tasks);
  }

  /**
   * Update an existing task
   * @param {string} taskId ID of the task to update
   * @param {Object} updatedTask Updated task properties
   * @returns {boolean} Success status
   */
  updateTask(taskId, updatedTask) {
    const tasks = this.getTasks();
    const index = tasks.findIndex(task => task.id === taskId);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...updatedTask };
      return this.saveTasks(tasks);
    }
    return false;
  }

  /**
   * Delete a task from storage
   * @param {string} taskId ID of the task to delete
   * @returns {boolean} Success status
   */
  deleteTask(taskId) {
    const tasks = this.getTasks();
    const filteredTasks = tasks.filter(task => task.id !== taskId);
    return this.saveTasks(filteredTasks);
  }

  /**
   * Get token count from storage
   * @returns {number} Token count
   */
  getTokens() {
    try {
      const tokens = localStorage.getItem(this.tokenKey);
      return tokens ? JSON.parse(tokens) : 0;
    } catch (e) {
      console.error('Error retrieving tokens:', e);
      return 0;
    }
  }

  /**
   * Save token count to storage
   * @param {number} tokenCount Number of tokens
   * @returns {boolean} Success status
   */
  saveTokens(tokenCount) {
    try {
      localStorage.setItem(this.tokenKey, JSON.stringify(tokenCount));
      return true;
    } catch (e) {
      console.error('Error saving tokens:', e);
      return false;
    }
  }
} 