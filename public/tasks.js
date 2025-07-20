// Task Management System
class TaskManager {
  constructor() {
    this.tasks = [];
    this.currentTask = null;
    this.filters = {
      status: ''
    };

    this.initializeEventListeners();
    this.loadTasks();
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
  }

  async loadTasks() {
    try {
      const response = await fetch('/api/graph');
      const data = await response.json();
      this.tasks = data.nodes.filter(node => node.type === 'task');
      
      console.log('Loaded tasks:', this.tasks); // Debug log
      
      this.renderTasks();
    } catch (error) {
      console.error('Error loading tasks:', error);
      // Show error message to user
      this.showError('Failed to load tasks. Please check your connection.');
    }
  }

  renderTasks() {
    const filteredTasks = this.filters.status 
      ? this.tasks.filter(task => task.status === this.filters.status)
      : this.tasks;

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

    this.updateTaskCounts();
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

  updateTaskCounts() {
    const counts = {
      'TODO': 0,
      'IN_PROGRESS': 0,
      'DONE': 0,
      'BLOCKED': 0,
      'CANCELLED': 0
    };

    const filteredTasks = this.filters.status 
      ? this.tasks.filter(task => task.status === this.filters.status)
      : this.tasks;

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
      modalDescription.textContent = task.description || 'No description available';
    }

    // Handle related components
    if (modalComponents) {
      if (task.relatedComponentIds && task.relatedComponentIds.length > 0) {
        modalComponents.innerHTML = '';
        task.relatedComponentIds.forEach(componentId => {
          const componentElement = document.createElement('span');
          componentElement.className = 'component-tag';
          componentElement.textContent = componentId;
          modalComponents.appendChild(componentElement);
        });
      } else {
        modalComponents.innerHTML = '<p class="no-components">No related components</p>';
      }
    }

    // Set up action buttons
    const viewInGraphBtn = document.getElementById('view-in-graph');
    const copyTaskIdBtn = document.getElementById('copy-task-id');

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
}

// Initialize the task manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new TaskManager();
});
