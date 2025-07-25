// Task Management System
class TaskManager {
  constructor() {
    this.tasks = [];
    this.components = [];
    this.currentTask = null;
    this.filters = {
      status: '',
      projects: new Set()
    };
    
    // View mode settings
    this.currentView = 'kanban'; // 'kanban' or 'progress'
    
    // Auto-refresh settings
    this.autoRefreshInterval = null;
    this.autoRefreshDelay = 30000; // 30 seconds default
    this.isAutoRefreshEnabled = true;
    this.lastUpdateTime = null;
    this.isLoading = false;

    this.initializeEventListeners();
    this.setupAutoRefresh();
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

    // Project multi-select setup
    this.setupMultiSelectProject();

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

    // View mode toggle buttons
    const kanbanViewBtn = document.getElementById('kanbanViewBtn');
    const progressViewBtn = document.getElementById('progressViewBtn');
    
    if (kanbanViewBtn) {
      kanbanViewBtn.addEventListener('click', () => this.switchView('kanban'));
    }
    
    if (progressViewBtn) {
      progressViewBtn.addEventListener('click', () => this.switchView('progress'));
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
    // Extract unique projects from tasks and components
    const projects = new Set();
    
    // Get projects directly from tasks (if they have codebase property)
    this.tasks.forEach(task => {
      if (task.codebase) {
        projects.add(task.codebase);
      }
      
      // Also check related components
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

    console.log('Available projects:', Array.from(projects)); // Debug log

    this.populateProjectMultiSelect(Array.from(projects).sort());
  }

  populateProjectMultiSelect(projects) {
    const container = document.getElementById('projectOptions');
    if (!container) return;
    
    // Keep the "All Projects" option, add individual project options
    projects.forEach(project => {
      const label = document.createElement('label');
      label.className = 'checkbox-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = project;
      checkbox.addEventListener('change', () => this.handleProjectSelection());
      
      const span = document.createElement('span');
      span.textContent = project;
      
      label.appendChild(checkbox);
      label.appendChild(span);
      container.appendChild(label);
    });
  }

  setupMultiSelectProject() {
    const btn = document.getElementById('projectSelectBtn');
    const dropdown = document.getElementById('projectSelectDropdown');
    const allOption = document.getElementById('allProjectsOption');
    
    if (!btn || !dropdown || !allOption) return;
    
    // Toggle dropdown
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
    
    // Handle "All Projects" option
    allOption.addEventListener('change', () => {
      if (allOption.checked) {
        // Uncheck all other options
        const otherOptions = dropdown.querySelectorAll('input[type="checkbox"]:not(#allProjectsOption)');
        otherOptions.forEach(option => option.checked = false);
        this.filters.projects.clear();
      }
      this.updateProjectButtonText();
      this.renderTasks();
    });
  }
  
  handleProjectSelection() {
    const allOption = document.getElementById('allProjectsOption');
    const otherOptions = document.querySelectorAll('#projectOptions input[type="checkbox"]:not(#allProjectsOption)');
    const selectedOptions = [...otherOptions].filter(option => option.checked);
    
    if (selectedOptions.length > 0) {
      // If any specific project is selected, uncheck "All Projects"
      if (allOption) allOption.checked = false;
      this.filters.projects = new Set(selectedOptions.map(option => option.value));
    } else {
      // If no specific project is selected, check "All Projects"
      if (allOption) allOption.checked = true;
      this.filters.projects.clear();
    }
    
    this.updateProjectButtonText();
    this.renderTasks();
  }
  
  updateProjectButtonText() {
    const textSpan = document.getElementById('projectSelectText');
    if (!textSpan) return;
    
    if (this.filters.projects.size === 0) {
      textSpan.textContent = 'All Projects';
    } else if (this.filters.projects.size === 1) {
      textSpan.textContent = [...this.filters.projects][0];
    } else {
      textSpan.textContent = `${this.filters.projects.size} Projects`;
    }
  }

  switchView(viewType) {
    this.currentView = viewType;
    
    // Update button states
    const kanbanBtn = document.getElementById('kanbanViewBtn');
    const progressBtn = document.getElementById('progressViewBtn');
    
    if (kanbanBtn && progressBtn) {
      kanbanBtn.classList.toggle('active', viewType === 'kanban');
      progressBtn.classList.toggle('active', viewType === 'progress');
    }
    
    // Show/hide appropriate containers
    const taskContainer = document.querySelector('.task-container');
    const progressContainer = document.getElementById('progress-view');
    
    if (taskContainer && progressContainer) {
      if (viewType === 'kanban') {
        taskContainer.style.display = 'block';
        progressContainer.style.display = 'none';
      } else {
        taskContainer.style.display = 'none';
        progressContainer.style.display = 'block';
      }
    }
    
    // Re-render tasks in the new view
    this.renderTasks();
  }

  renderTasks() {
    let filteredTasks = this.tasks;
    
    console.log('Rendering tasks with filters:', this.filters);
    console.log('Total tasks before filtering:', filteredTasks.length);
    
    // Apply status filter
    if (this.filters.status) {
      filteredTasks = filteredTasks.filter(task => task.status === this.filters.status);
      console.log('Tasks after status filter:', filteredTasks.length);
    }
    
    // Apply projects filter
    if (this.filters.projects.size > 0) {
      console.log('Applying projects filter for:', this.filters.projects);

      filteredTasks = filteredTasks.filter(task => {
        // First check if task has a direct codebase property
        if (this.filters.projects.has(task.codebase)) {
          console.log('Task matches by direct codebase:', task.name, task.codebase);
          return true;
        }

        // Then check related components
        if (task.relatedComponentIds && task.relatedComponentIds.length > 0) {
          const matches = task.relatedComponentIds.some(componentId => {
            const component = this.components.find(c => c.id === componentId);
            if (component && this.filters.projects.has(component.codebase)) {
              console.log('Task matches by related component:', task.name, 'via', component.name, component.codebase);
              return true;
            }
            return false;
          });
          if (matches) return true;
        }

        // If task has no codebase and no related components, exclude it
        console.log('Task excluded:', task.name, 'codebase:', task.codebase, 'relatedComponents:', task.relatedComponentIds?.length || 0);
        return false;
      });
      
      console.log('Tasks after projects filter:', filteredTasks.length);
    }

    // Render based on current view mode
    if (this.currentView === 'progress') {
      this.renderProgressView(filteredTasks);
    } else {
      this.renderKanbanView(filteredTasks);
    }
  }

  renderKanbanView(filteredTasks) {
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

  renderProgressView(filteredTasks) {
    // Sort tasks by update time (newest first), fallback to created time
    const sortedTasks = filteredTasks.sort((a, b) => {
      const aTime = a.updatedAt || a.lastModified || a.createdAt || a.created;
      const bTime = b.updatedAt || b.lastModified || b.createdAt || b.created;
      
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      
      return new Date(bTime) - new Date(aTime);
    });

    // Update progress stats
    this.updateProgressStats(filteredTasks);

    // Clear and populate progress list
    const progressList = document.getElementById('progress-task-list');
    if (progressList) {
      progressList.innerHTML = '';
      
      sortedTasks.forEach(task => {
        const taskRow = this.createProgressTaskRow(task);
        progressList.appendChild(taskRow);
      });
    }
  }

  updateProgressStats(filteredTasks) {
    const totalCountElement = document.getElementById('progress-total-count');
    const completionRateElement = document.getElementById('progress-completion-rate');
    
    if (totalCountElement) {
      totalCountElement.textContent = `Total: ${filteredTasks.length}`;
    }
    
    if (completionRateElement && filteredTasks.length > 0) {
      // Normalize progress values: if > 1, treat as percentage (divide by 100)
      const normalizedProgress = filteredTasks.map(task => {
        let progress = task.progress || 0;
        // If progress is greater than 1, assume it's a percentage and convert to decimal
        if (progress > 1) {
          progress = progress / 100;
        }
        // Cap at 1.0 (100%)
        return Math.min(progress, 1.0);
      });
      
      const avgProgress = normalizedProgress.reduce((sum, progress) => sum + progress, 0) / normalizedProgress.length;
      const avgProgressPercent = Math.min(Math.round(avgProgress * 100), 100); // Cap at 100%
      
      completionRateElement.textContent = `Avg. Progress: ${avgProgressPercent}%`;
    } else if (completionRateElement) {
      completionRateElement.textContent = 'Avg. Progress: 0%';
    }
  }

  createProgressTaskRow(task) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'progress-task-row';
    rowDiv.setAttribute('data-task-id', task.id);
    rowDiv.setAttribute('data-status', task.status);
    
    // Normalize progress: if > 1, treat as percentage (divide by 100), then cap at 100%
    let normalizedProgress = task.progress || 0;
    if (normalizedProgress > 1) {
      normalizedProgress = normalizedProgress / 100;
    }
    normalizedProgress = Math.min(normalizedProgress, 1.0);
    const progressPercentage = Math.round(normalizedProgress * 100);
    
    // Get status display name
    const statusDisplayNames = {
      'TODO': 'Todo',
      'IN_PROGRESS': 'In Progress',
      'DONE': 'Done',
      'BLOCKED': 'Blocked',
      'CANCELLED': 'Cancelled'
    };
    
    const statusName = statusDisplayNames[task.status] || task.status;
    
    // Get real last updated time from the task data
    const lastUpdated = this.formatTimestamp(task.updatedAt || task.lastModified || task.createdAt || task.created);
    
    rowDiv.innerHTML = `
      <div class="progress-task-header">
        <h3 class="progress-task-title">${task.name || 'Unnamed Task'}</h3>
        <div class="progress-task-meta">
          <span class="progress-task-status">${statusName}</span>
          <span class="progress-task-updated">Updated ${lastUpdated}</span>
        </div>
      </div>
      <div class="progress-task-description">
        ${task.description || 'No description available'}
      </div>
      <div class="progress-task-progress-container">
        <div class="progress-task-progress-bar">
          <div class="progress-task-progress-fill" style="width: ${progressPercentage}%"></div>
        </div>
        <span class="progress-task-progress-text">${progressPercentage}%</span>
      </div>
    `;

    // Add click handler
    rowDiv.addEventListener('click', () => this.openTaskModal(task));

    return rowDiv;
  }

  getSimulatedUpdateTimestamp(task) {
    // Generate a consistent timestamp based on task ID for deterministic ordering
    // In a real implementation, this would come from a lastUpdated timestamp
    const baseTime = new Date().getTime();
    const taskHash = this.hashCode(task.id || task.name || 'default');
    
    let hoursAgo;
    switch (task.status) {
      case 'IN_PROGRESS':
        hoursAgo = (Math.abs(taskHash) % 4) + 1; // 1-4 hours ago
        break;
      case 'BLOCKED':
        hoursAgo = (Math.abs(taskHash) % 12) + 6; // 6-18 hours ago
        break;
      case 'TODO':
        hoursAgo = (Math.abs(taskHash) % 24) + 12; // 12-36 hours ago
        break;
      case 'DONE':
        hoursAgo = (Math.abs(taskHash) % 48) + 24; // 1-3 days ago
        break;
      default:
        hoursAgo = (Math.abs(taskHash) % 72) + 48; // 2-5 days ago
    }
    
    return baseTime - (hoursAgo * 60 * 60 * 1000);
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  getSimulatedUpdateTime(task) {
    // In a real implementation, this would come from a lastUpdated timestamp
    // For now, we'll simulate based on task properties
    const now = new Date();
    let hoursAgo;
    
    switch (task.status) {
      case 'IN_PROGRESS':
        hoursAgo = Math.floor(Math.random() * 4) + 1; // 1-4 hours ago
        break;
      case 'BLOCKED':
        hoursAgo = Math.floor(Math.random() * 12) + 6; // 6-18 hours ago
        break;
      case 'TODO':
        hoursAgo = Math.floor(Math.random() * 24) + 12; // 12-36 hours ago
        break;
      case 'DONE':
        hoursAgo = Math.floor(Math.random() * 48) + 24; // 1-3 days ago
        break;
      default:
        hoursAgo = Math.floor(Math.random() * 72) + 48; // 2-5 days ago
    }
    
    if (hoursAgo < 24) {
      return `${hoursAgo}h ago`;
    } else {
      const daysAgo = Math.floor(hoursAgo / 24);
      return `${daysAgo}d ago`;
    }
  }

  createTaskElement(task) {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-item';
    taskDiv.setAttribute('data-task-id', task.id);
    
    // Normalize progress: if > 1, treat as percentage (divide by 100), then cap at 100%
    let normalizedProgress = task.progress || 0;
    if (normalizedProgress > 1) {
      normalizedProgress = normalizedProgress / 100;
    }
    normalizedProgress = Math.min(normalizedProgress, 1.0);
    const progressPercentage = Math.round(normalizedProgress * 100);
    
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
    
    // Normalize progress: if > 1, treat as percentage (divide by 100), then cap at 100%
    let normalizedProgress = task.progress || 0;
    if (normalizedProgress > 1) {
      normalizedProgress = normalizedProgress / 100;
    }
    normalizedProgress = Math.min(normalizedProgress, 1.0);
    const progressPercentage = Math.round(normalizedProgress * 100);
    
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

    // Load and display comments
    this.loadTaskComments(task.id);
    
    // Set up comment form
    const addCommentBtn = document.getElementById('add-comment');
    const newCommentTextarea = document.getElementById('new-comment');
    
    if (addCommentBtn) {
      addCommentBtn.onclick = () => this.addComment(task.id, newCommentTextarea);
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

  async viewConnectedGraph(task) {
    try {
      const response = await fetch(`/api/tasks/${task.id}/connected-graph`);
      if (!response.ok) {
        throw new Error('Failed to load connected graph');
      }
      
      const graphData = await response.json();
      
      // Store the graph data in sessionStorage for the main graph to use
      sessionStorage.setItem('taskConnectedGraph', JSON.stringify({
        ...graphData,
        taskId: task.id,
        taskName: task.name
      }));
      
      // Navigate to main graph view with special parameter
      window.location.href = `/?mode=task-connected&taskId=${task.id}`;
    } catch (error) {
      console.error('Error loading connected graph:', error);
      this.showError('Failed to load connected graph: ' + error.message);
    }
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

  // ============================================================================
  // COMMENT MANAGEMENT METHODS
  // ============================================================================

  async loadTaskComments(taskId) {
    try {
      const response = await fetch(`/api/nodes/${taskId}/comments`);
      if (!response.ok) {
        throw new Error('Failed to load comments');
      }
      const comments = await response.json();
      this.displayComments(comments);
    } catch (error) {
      console.error('Error loading comments:', error);
      this.displayComments([]);
    }
  }

  displayComments(comments) {
    const commentsContainer = document.getElementById('task-comments');
    if (!commentsContainer) return;

    if (!comments.length) {
      commentsContainer.innerHTML = '<p class="no-comments">No comments yet.</p>';
      return;
    }

    let commentsHtml = '';
    comments.forEach(comment => {
      commentsHtml += `
        <div class="comment-item">
          <div class="comment-meta">
            <span class="comment-author">${comment.author}</span>
            <span class="comment-timestamp">${new Date(comment.timestamp).toLocaleString()}</span>
          </div>
          <div class="comment-content">${comment.content}</div>
        </div>
      `;
    });

    commentsContainer.innerHTML = commentsHtml;
  }

  async addComment(taskId, textarea) {
    const content = textarea.value.trim();
    if (!content) {
      alert('Please enter a comment');
      return;
    }

    try {
      const addButton = document.getElementById('add-comment');
      if (addButton) {
        addButton.disabled = true;
        addButton.textContent = 'Adding...';
      }

      const response = await fetch(`/api/nodes/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content,
          author: 'user' // Could be made dynamic
        })
      });

      if (response.ok) {
        textarea.value = ''; // Clear the textarea
        this.loadTaskComments(taskId); // Reload comments
        this.showSuccess('Comment added successfully!');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      this.showError('Failed to add comment: ' + error.message);
    } finally {
      const addButton = document.getElementById('add-comment');
      if (addButton) {
        addButton.disabled = false;
        addButton.textContent = 'Add Comment';
      }
    }
  }

  // ============================================================================
  // AUTO-REFRESH METHODS
  // ============================================================================

  setupAutoRefresh() {
    // Add auto-refresh controls to the page
    this.createAutoRefreshControls();
    
    // Start auto-refresh if enabled
    if (this.isAutoRefreshEnabled) {
      this.startAutoRefresh();
    }
    
    // Listen for visibility changes to pause/resume auto-refresh
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAutoRefresh();
      } else if (this.isAutoRefreshEnabled) {
        this.resumeAutoRefresh();
      }
    });
  }

  createAutoRefreshControls() {
    const header = document.querySelector('.header');
    if (!header) return;

    // Create auto-refresh status indicator
    const autoRefreshContainer = document.createElement('div');
    autoRefreshContainer.className = 'auto-refresh-controls';
    autoRefreshContainer.innerHTML = `
      <div class="auto-refresh-status">
        <span id="refresh-status" class="refresh-indicator">
          <span class="refresh-dot"></span>
          <span id="refresh-text">Auto-refresh: ON</span>
        </span>
        <span id="last-update" class="last-update-time"></span>
      </div>
      <div class="auto-refresh-buttons">
        <button id="toggle-auto-refresh" class="toggle-btn" title="Toggle auto-refresh">
          <span id="toggle-icon">⏸️</span>
        </button>
        <select id="refresh-interval" class="interval-select" title="Set refresh interval">
          <option value="15000">15s</option>
          <option value="30000" selected>30s</option>
          <option value="60000">1m</option>
          <option value="300000">5m</option>
          <option value="600000">10m</option>
        </select>
      </div>
    `;

    // Insert after the main header
    header.insertAdjacentElement('afterend', autoRefreshContainer);

    // Add event listeners
    this.setupAutoRefreshEventListeners();
    
    // Update initial display
    this.updateRefreshStatus();
  }

  setupAutoRefreshEventListeners() {
    // Toggle auto-refresh
    const toggleBtn = document.getElementById('toggle-auto-refresh');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleAutoRefresh());
    }

    // Change refresh interval
    const intervalSelect = document.getElementById('refresh-interval');
    if (intervalSelect) {
      intervalSelect.addEventListener('change', (e) => {
        this.autoRefreshDelay = parseInt(e.target.value);
        if (this.isAutoRefreshEnabled) {
          this.restartAutoRefresh();
        }
      });
    }
  }

  startAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    this.autoRefreshInterval = setInterval(() => {
      this.refreshTasks();
    }, this.autoRefreshDelay);

    this.isAutoRefreshEnabled = true;
    this.updateRefreshStatus();
  }

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }

    this.isAutoRefreshEnabled = false;
    this.updateRefreshStatus();
  }

  pauseAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  resumeAutoRefresh() {
    if (this.isAutoRefreshEnabled && !this.autoRefreshInterval) {
      this.startAutoRefresh();
    }
  }

  restartAutoRefresh() {
    this.stopAutoRefresh();
    this.startAutoRefresh();
  }

  toggleAutoRefresh() {
    if (this.isAutoRefreshEnabled) {
      this.stopAutoRefresh();
    } else {
      this.startAutoRefresh();
    }
  }

  async refreshTasks() {
    if (this.isLoading) return;
    
    try {
      this.isLoading = true;
      this.updateRefreshStatus(true);
      
      const response = await fetch('/api/graph');
      const data = await response.json();
      const newTasks = data.nodes.filter(node => node.type === 'task');
      const newComponents = data.nodes.filter(node => node.type === 'component');
      
      // Check if there are any changes
      const hasChanges = this.hasTaskChanges(newTasks);
      
      this.tasks = newTasks;
      this.components = newComponents;
      
      // Only re-render if there are changes
      if (hasChanges) {
        this.populateProjectFilter();
        this.renderTasks();
        this.showRefreshNotification();
      }
      
      this.lastUpdateTime = new Date();
      
    } catch (error) {
      console.error('Auto-refresh error:', error);
      // Don't show error for auto-refresh failures, just log them
    } finally {
      this.isLoading = false;
      this.updateRefreshStatus();
    }
  }

  hasTaskChanges(newTasks) {
    if (this.tasks.length !== newTasks.length) {
      return true;
    }
    
    // Check for changes in existing tasks
    for (let i = 0; i < newTasks.length; i++) {
      const newTask = newTasks[i];
      const oldTask = this.tasks.find(t => t.id === newTask.id);
      
      if (!oldTask) {
        return true; // New task
      }
      
      // Check key fields that would trigger a visual update
      if (oldTask.status !== newTask.status ||
          oldTask.progress !== newTask.progress ||
          oldTask.name !== newTask.name ||
          oldTask.description !== newTask.description) {
        return true;
      }
    }
    
    return false;
  }

  updateRefreshStatus(isRefreshing = false) {
    const refreshText = document.getElementById('refresh-text');
    const refreshDot = document.querySelector('.refresh-dot');
    const toggleIcon = document.getElementById('toggle-icon');
    const lastUpdateElement = document.getElementById('last-update');

    if (refreshText) {
      if (isRefreshing) {
        refreshText.textContent = 'Refreshing...';
      } else {
        refreshText.textContent = `Auto-refresh: ${this.isAutoRefreshEnabled ? 'ON' : 'OFF'}`;
      }
    }

    if (refreshDot) {
      refreshDot.className = `refresh-dot ${
        isRefreshing ? 'refreshing' : 
        this.isAutoRefreshEnabled ? 'active' : 'inactive'
      }`;
    }

    if (toggleIcon) {
      toggleIcon.textContent = this.isAutoRefreshEnabled ? '⏸️' : '▶️';
    }

    if (lastUpdateElement && this.lastUpdateTime) {
      const timeAgo = this.getTimeAgo(this.lastUpdateTime);
      lastUpdateElement.textContent = `Updated ${timeAgo}`;
    }
  }

  showRefreshNotification() {
    // Create a subtle notification for successful refresh
    let notification = document.getElementById('refresh-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'refresh-notification';
      notification.className = 'refresh-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      `;
      document.body.appendChild(notification);
    }

    notification.textContent = 'Tasks updated';
    notification.style.opacity = '1';

    setTimeout(() => {
      notification.style.opacity = '0';
    }, 2000);
  }

  getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    }
  }

  formatTimestamp(timestamp) {
    if (!timestamp) {
      return 'unknown';
    }
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInSeconds = Math.floor((now - date) / 1000);
      
      if (diffInSeconds < 60) {
        return `${diffInSeconds}s ago`;
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes}m ago`;
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours}h ago`;
      } else {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days}d ago`;
      }
    } catch (error) {
      console.warn('Error formatting timestamp:', timestamp, error);
      return 'unknown';
    }
  }

  // Override the existing loadTasks to update timestamp
  async loadTasks() {
    try {
      this.isLoading = true;
      this.updateRefreshStatus(true);
      
      const response = await fetch('/api/graph');
      const data = await response.json();
      this.tasks = data.nodes.filter(node => node.type === 'task');
      this.components = data.nodes.filter(node => node.type === 'component');
      
      console.log('Loaded tasks with timestamps:', this.tasks.map(t => ({ 
        name: t.name, 
        created: t.created, 
        updated: t.updated, 
        createdAt: t.createdAt, 
        updatedAt: t.updatedAt,
        lastModified: t.lastModified 
      }))); // Debug log
      
      this.populateProjectFilter();
      this.renderTasks();
      
      this.lastUpdateTime = new Date();
      
    } catch (error) {
      console.error('Error loading tasks:', error);
      // Show error message to user
      this.showError('Failed to load tasks. Please check your connection.');
    } finally {
      this.isLoading = false;
      this.updateRefreshStatus();
    }
  }
}

// Initialize the task manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
  window.taskManager = new TaskManager();
});
