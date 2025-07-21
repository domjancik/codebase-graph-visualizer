// Task Management System
class TaskManager {
  constructor() {
    this.tasks = [];
    this.components = [];
    this.currentTask = null;
    this.filters = {
      status: '',
      project: ''
    };

    this.initializeEventListeners();
    this.loadTasks();
  }

  renderMarkdown(text) {
    if (!text || typeof text !== 'string') {
      return text || '';
    }
    
    try {
      // Configure marked with safe defaults and syntax highlighting
      if (typeof marked !== 'undefined') {
        // Configure marked options
        marked.setOptions({
          breaks: true, // Support line breaks
          gfm: true,    // GitHub Flavored Markdown
          sanitize: false, // We'll sanitize manually if needed
          highlight: function(code, lang) {
            if (typeof Prism !== 'undefined' && lang && Prism.languages[lang]) {
              try {
                return Prism.highlight(code, Prism.languages[lang], lang);
              } catch (e) {
                console.warn('Prism highlighting failed:', e);
              }
            }
            return code;
          }
        });
        
        return marked.parse(text);
      } else {
        // Fallback if marked is not available - just return plain text with basic formatting
        return text.replace(/\n/g, '<br>');
      }
    } catch (error) {
      console.warn('Markdown rendering failed:', error);
      return text.replace(/\n/g, '<br>');
    }
  }

  initializeEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadTasks());
    }

    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.filters.status = e.target.value;
        this.renderTasks();
      });
    }

    // Project filter
    const projectFilter = document.getElementById('projectFilter');
    if (projectFilter) {
      projectFilter.addEventListener('change', (e) => {
        this.filters.project = e.target.value;
        this.renderTasks();
      });
    }

    // Modal close
    const closeModal = document.getElementById('close-modal');
    if (closeModal) {
      closeModal.addEventListener('click', () => this.closeModal());
    }

    // Modal background click
    const modal = document.getElementById('task-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });
    }

    // Add Task Button
    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => this.openAddTaskModal());
    }

    // Add Task Modal close
    const closeAddTaskModal = document.getElementById('close-add-task-modal');
    if (closeAddTaskModal) {
      closeAddTaskModal.addEventListener('click', () => this.closeAddTaskModal());
    }

    // Add Task form
    const addTaskForm = document.getElementById('add-task-form');
    if (addTaskForm) {
      addTaskForm.addEventListener('submit', (e) => this.handleAddTask(e));
    }

    // Cancel task button
    const cancelTaskBtn = document.getElementById('cancel-task');
    if (cancelTaskBtn) {
      cancelTaskBtn.addEventListener('click', () => this.closeAddTaskModal());
    }
  }

  async loadTasks() {
    try {
      const response = await fetch('/api/graph');
      const data = await response.json();
      this.tasks = data.nodes.filter(node => node.type === 'task');
      this.components = data.nodes.filter(node => node.type === 'component');
      
      console.log('Loaded tasks:', this.tasks); // Debug log
      
      this.populateProjectFilter();
      this.renderTasks();
    } catch (error) {
      console.error('Error loading tasks:', error);
      // Show error message to user
      this.showError('Failed to load tasks. Please check your connection.');
    }
  }

  populateProjectFilter() {
    // Extract unique projects from related components
    const projects = new Set();
    
    this.tasks.forEach(task => {
      if (task.relatedComponentIds && task.relatedComponentIds.length > 0) {
        task.relatedComponentIds.forEach(componentId => {
          const component = this.components.find(c => c.id === componentId);
          if (component && component.codebase) {
            projects.add(component.codebase);
          }
        });
      }
    });

    // Also get projects directly from components
    this.components.forEach(component => {
      if (component.codebase) {
        projects.add(component.codebase);
      }
    });

    const projectFilter = document.getElementById('projectFilter');
    if (projectFilter) {
      // Clear existing options except "All Projects"
      projectFilter.innerHTML = '<option value="">All Projects</option>';
      
      // Add project options
      Array.from(projects).sort().forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        projectFilter.appendChild(option);
      });
    }
  }

  renderTasks() {
    let filteredTasks = this.tasks;
    
    // Apply status filter
    if (this.filters.status) {
      filteredTasks = filteredTasks.filter(task => task.status === this.filters.status);
    }
    
    // Apply project filter
    if (this.filters.project) {
      filteredTasks = filteredTasks.filter(task => {
        // First check if task has a direct codebase property
        if (task.codebase === this.filters.project) {
          return true;
        }
        
        // Then check related components
        if (task.relatedComponentIds && task.relatedComponentIds.length > 0) {
          return task.relatedComponentIds.some(componentId => {
            const component = this.components.find(c => c.id === componentId);
            return component && component.codebase === this.filters.project;
          });
        }
        
        // If task has no codebase and no related components, exclude it
        return false;
      });
    }

    // Clear all columns
    const columns = {
      'TODO': document.getElementById('todo-tasks'),
      'IN_PROGRESS': document.getElementById('in-progress-tasks'),
      'DONE': document.getElementById('done-tasks'),
      'BLOCKED': document.getElementById('blocked-tasks'),
      'CANCELLED': document.getElementById('cancelled-tasks')
    };

    // Clear columns
    Object.values(columns).forEach(column => {
      if (column) column.innerHTML = '';
    });

    // Populate tasks
    filteredTasks.forEach(task => {
      const column = columns[task.status];
      if (column) {
        const taskElement = this.createTaskElement(task);
        column.appendChild(taskElement);
      }
    });

    this.updateTaskCounts(filteredTasks);
  }

  createTaskElement(task) {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-item';
    taskDiv.setAttribute('data-task-id', task.id);
    
    const progressPercentage = Math.round((task.progress || 0) * 100);
    
    taskDiv.innerHTML = `
      <div class="task-header">
        <h4 class="task-name">${task.name || 'Unnamed Task'}</h4>
        <span class="task-progress">${progressPercentage}%</span>
      </div>
      <div class="task-description">
        ${task.description ? task.description.substring(0, 100) + (task.description.length > 100 ? '...' : '') : 'No description'}
      </div>
      <div class="task-progress-bar">
        <div class="task-progress-fill" style="width: ${progressPercentage}%"></div>
      </div>
    `;

    // Add click handler
    taskDiv.addEventListener('click', () => this.openTaskModal(task));

    return taskDiv;
  }

  updateTaskCounts(filteredTasks) {
    const counts = {
      'TODO': 0,
      'IN_PROGRESS': 0,
      'DONE': 0,
      'BLOCKED': 0,
      'CANCELLED': 0
    };

    filteredTasks.forEach(task => {
      if (counts.hasOwnProperty(task.status)) {
        counts[task.status]++;
      }
    });

    // Update count displays
    const countElements = {
      'TODO': document.getElementById('todo-count'),
      'IN_PROGRESS': document.getElementById('in-progress-count'),
      'DONE': document.getElementById('done-count'),
      'BLOCKED': document.getElementById('blocked-count'),
      'CANCELLED': document.getElementById('cancelled-count')
    };

    Object.entries(counts).forEach(([status, count]) => {
      const element = countElements[status];
      if (element) {
        element.textContent = count;
      }
    });
  }

  openTaskModal(task) {
    this.currentTask = task;
    
    const modal = document.getElementById('task-modal');
    const modalTaskName = document.getElementById('modal-task-name');
    const modalStatus = document.getElementById('modal-status');
    const modalProgress = document.getElementById('modal-progress');
    const modalProgressText = document.getElementById('modal-progress-text');
    const modalDescription = document.getElementById('modal-description');
    const modalComponents = document.getElementById('modal-components');

    if (modalTaskName) modalTaskName.textContent = task.name || 'Unnamed Task';
    if (modalStatus) {
      modalStatus.textContent = task.status || 'TODO';
      modalStatus.className = `status-badge status-${(task.status || 'TODO').toLowerCase()}`;
    }
    
    const progressPercentage = Math.round((task.progress || 0) * 100);
    if (modalProgress) {
      modalProgress.style.width = `${progressPercentage}%`;
    }
    if (modalProgressText) {
      modalProgressText.textContent = `${progressPercentage}%`;
    }

    if (modalDescription) {
      if (task.description) {
        modalDescription.innerHTML = `<div class="markdown-content">${this.renderMarkdown(task.description)}</div>`;
      } else {
        modalDescription.textContent = 'No description available';
      }
    }

    // Handle related components
    if (modalComponents) {
      if (task.relatedComponentIds && task.relatedComponentIds.length > 0) {
        modalComponents.innerHTML = '';
        task.relatedComponentIds.forEach(componentId => {
          const component = this.components.find(c => c.id === componentId);
          const componentElement = document.createElement('span');
          componentElement.className = 'component-tag';
          componentElement.textContent = component ? component.name : componentId;
          
          // Add tooltip with additional info if component found
          if (component) {
            componentElement.title = `${component.componentType || component.type} - ${component.codebase || 'Unknown project'}`;
          }
          
          modalComponents.appendChild(componentElement);
        });
      } else {
        modalComponents.innerHTML = '<p class="no-components">No related components</p>';
      }
    }

    // Set up action buttons
    const executeTaskBtn = document.getElementById('execute-task');
    const viewInGraphBtn = document.getElementById('view-in-graph');
    const copyTaskIdBtn = document.getElementById('copy-task-id');

    if (executeTaskBtn) {
      executeTaskBtn.onclick = () => this.executeTask(task);
      executeTaskBtn.disabled = !task.command; // Disable if no command
      if (!task.command) {
        executeTaskBtn.title = 'No command configured for this task';
      }
    }

    if (viewInGraphBtn) {
      viewInGraphBtn.onclick = () => this.viewInGraph(task);
    }

    if (copyTaskIdBtn) {
      copyTaskIdBtn.onclick = () => this.copyTaskId(task);
    }

    if (modal) {
      modal.style.display = 'block';
    }
  }

  closeModal() {
    const modal = document.getElementById('task-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    this.currentTask = null;
  }

  viewInGraph(task) {
    // Navigate to main graph view with task highlighted
    window.location.href = `/?highlight=${task.id}`;
  }

  copyTaskId(task) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(task.id).then(() => {
        alert('Task ID copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy task ID:', err);
        this.fallbackCopyTaskId(task.id);
      });
    } else {
      this.fallbackCopyTaskId(task.id);
    }
  }

  fallbackCopyTaskId(taskId) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = taskId;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      alert('Task ID copied to clipboard!');
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert('Failed to copy task ID');
    }
    document.body.removeChild(textArea);
  }

  showError(message) {
    // Create or update error display
    let errorDiv = document.getElementById('error-message');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'error-message';
      errorDiv.className = 'error-message';
      document.querySelector('.task-container').prepend(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    // Hide error after 5 seconds
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }

  openAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    const taskProjectSelect = document.getElementById('task-project');
    
    // Populate project dropdown
    if (taskProjectSelect) {
      const projects = new Set();
      this.components.forEach(component => {
        if (component.codebase) {
          projects.add(component.codebase);
        }
      });
      
      taskProjectSelect.innerHTML = '<option value="">Select project...</option>';
      Array.from(projects).sort().forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        taskProjectSelect.appendChild(option);
      });
    }
    
    if (modal) {
      modal.style.display = 'block';
    }
  }

  closeAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    
    // Reset form
    const form = document.getElementById('add-task-form');
    if (form) {
      form.reset();
    }
  }

  async handleAddTask(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const taskData = {
      name: formData.get('name'),
      description: formData.get('description'),
      status: formData.get('status'),
      progress: parseFloat(formData.get('progress')) / 100,
      command: formData.get('command')
    };
    
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });
      
      if (response.ok) {
        this.closeAddTaskModal();
        this.loadTasks(); // Reload tasks to show the new one
        this.showSuccess('Task created successfully!');
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      this.showError('Failed to create task: ' + error.message);
    }
  }

  async executeTask(task) {
    if (!task.command) {
      alert('No command configured for this task');
      return;
    }
    
    const confirmed = confirm(`Execute command: "${task.command}"?`);
    if (!confirmed) return;
    
    try {
      const executeBtn = document.getElementById('execute-task');
      if (executeBtn) {
        executeBtn.disabled = true;
        executeBtn.textContent = '⏳ Executing...';
      }
      
      const response = await fetch('/api/tasks/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskId: task.id,
          command: task.command
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        this.showSuccess('Task executed successfully!');
        // Update task status to IN_PROGRESS if it was TODO
        if (task.status === 'TODO') {
          await this.updateTaskStatus(task.id, 'IN_PROGRESS');
        }
        this.loadTasks(); // Reload to show updated status
      } else {
        throw new Error(result.message || 'Execution failed');
      }
    } catch (error) {
      console.error('Error executing task:', error);
      this.showError('Failed to execute task: ' + error.message);
    } finally {
      const executeBtn = document.getElementById('execute-task');
      if (executeBtn) {
        executeBtn.disabled = false;
        executeBtn.textContent = '▶️ Execute Task';
      }
    }
  }

  async updateTaskStatus(taskId, newStatus) {
    try {
      await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  }

  showSuccess(message) {
    // Create or update success display
    let successDiv = document.getElementById('success-message');
    if (!successDiv) {
      successDiv = document.createElement('div');
      successDiv.id = 'success-message';
      successDiv.className = 'success-message';
      successDiv.style.cssText = 'background: #d4edda; color: #155724; padding: 12px; border-radius: 4px; margin-bottom: 20px; border: 1px solid #c3e6cb;';
      document.querySelector('.task-container').prepend(successDiv);
    }
    successDiv.textContent = message;
    successDiv.style.display = 'block';

    // Hide success message after 3 seconds
    setTimeout(() => {
      successDiv.style.display = 'none';
    }, 3000);
  }
}

// Initialize the task manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new TaskManager();
});
