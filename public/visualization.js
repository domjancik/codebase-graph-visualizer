// Codebase Graph Visualizer - D3.js Implementation
class GraphVisualizer {
  constructor() {
    this.width = document.getElementById('graph').clientWidth;
    this.height = document.getElementById('graph').clientHeight;
    
    this.svg = d3.select('#graph')
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .call(d3.zoom().on('zoom', (event) => {
        this.container.attr('transform', event.transform);
      }))
      .append('g');
    
    this.container = this.svg;
    this.tooltip = d3.select('#tooltip');
    
    // Default color schemes - will be dynamically expanded
    this.defaultComponentColors = {
      'FILE': '#4CAF50',
      'FUNCTION': '#2196F3',
      'CLASS': '#FF9800',
      'MODULE': '#9C27B0',
      'SYSTEM': '#F44336',
      'INTERFACE': '#00BCD4',
      'VARIABLE': '#8BC34A',
      'CONSTANT': '#795548'
    };
    
    this.taskColors = {
      'TODO': '#9E9E9E',
      'IN_PROGRESS': '#2196F3',
      'DONE': '#4CAF50',
      'BLOCKED': '#FF5722',
      'CANCELLED': '#607D8B'
    };
    
    this.defaultRelationshipColors = {
      'DEPENDS_ON': '#F44336',
      'IMPLEMENTS': '#4CAF50',
      'EXTENDS': '#FF9800',
      'CONTAINS': '#2196F3',
      'CALLS': '#9C27B0',
      'IMPORTS': '#00BCD4',
      'EXPORTS': '#8BC34A',
      'OVERRIDES': '#795548',
      'USES': '#607D8B',
      'CREATES': '#E91E63',
      'RELATES_TO': '#9E9E9E'
    };
    
    // Dynamic colors will be populated from server data
    this.componentColors = { ...this.defaultComponentColors };
    this.relationshipColors = { ...this.defaultRelationshipColors };
    
    // Simulation
    this.simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius(15));
    
    // State
    this.data = { nodes: [], links: [] };
    this.filteredData = { nodes: [], links: [] };
    this.selectedNode = null;
    this.filters = {
      componentTypes: new Set(),
      relationshipTypes: new Set(),
      taskStatuses: new Set(),
      selectedCodebases: new Set()
    };
    
    this.initializeEventListeners();
    this.setupResizableSidebar();
    this.loadDynamicTypes().then(() => {
      this.loadData();
    });
    
    // Check for highlight parameter in URL
    this.checkHighlightParameter();
  }

  async loadTasks() {
    try {
      const response = await fetch('/api/graph');
      const data = await response.json();
      const taskNodes = data.nodes.filter(node => node.type === 'task');
      this.renderTasks(taskNodes);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }

  renderTasks(tasks) {
    const columns = {
      TODO: document.getElementById('todo-tasks'),
      IN_PROGRESS: document.getElementById('in-progress-tasks'),
      DONE: document.getElementById('done-tasks'),
      BLOCKED: document.getElementById('blocked-tasks'),
      CANCELLED: document.getElementById('cancelled-tasks')
    };

    Object.keys(columns).forEach(status => columns[status].innerHTML = '');

    tasks.forEach(task => {
      const taskElement = document.createElement('div');
      taskElement.className = 'task-item';
      taskElement.textContent = task.name;
      columns[task.status].appendChild(taskElement);
    });

    this.updateTaskCounts(tasks);
  }

  updateTaskCounts(tasks) {
    const counts = {
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      BLOCKED: 0,
      CANCELLED: 0
    };

    tasks.forEach(task => counts[task.status]++);

    document.getElementById('todo-count').textContent = counts.TODO;
    document.getElementById('in-progress-count').textContent = counts.IN_PROGRESS;
    document.getElementById('done-count').textContent = counts.DONE;
    document.getElementById('blocked-count').textContent = counts.BLOCKED;
    document.getElementById('cancelled-count').textContent = counts.CANCELLED;
  }
  
  initializeEventListeners() {
    // Control buttons
    document.getElementById('refreshBtn').addEventListener('click', () => this.loadData());
    document.getElementById('centerBtn').addEventListener('click', () => this.centerGraph());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
    
    // Multi-select codebase functionality
    this.setupMultiSelectCodebase();
    
    // Layout controls
    document.getElementById('forceStrength').addEventListener('input', (e) => {
      this.simulation.force('charge').strength(-e.target.value);
      this.simulation.alpha(0.3).restart();
    });
    
    document.getElementById('linkDistance').addEventListener('input', (e) => {
      this.simulation.force('link').distance(e.target.value);
      this.simulation.alpha(0.3).restart();
    });
    
    document.getElementById('charge').addEventListener('input', (e) => {
      this.simulation.force('charge').strength(e.target.value);
      this.simulation.alpha(0.3).restart();
    });
  }
  
  setupResizableSidebar() {
    const sidebar = document.getElementById('sidebar');
    const resizeHandle = document.getElementById('sidebarResizeHandle');
    
    if (!sidebar || !resizeHandle) {
      console.warn('Sidebar or resize handle not found');
      return;
    }
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    // Mouse down on resize handle
    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = parseInt(getComputedStyle(sidebar).width, 10);
      
      // Add resizing class to disable transitions and text selection
      sidebar.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      e.preventDefault();
    });
    
    // Mouse move anywhere in document
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const width = startWidth + (e.clientX - startX);
      const minWidth = 200;
      const maxWidth = window.innerWidth * 0.5; // 50% of viewport width
      
      // Clamp width within bounds
      const clampedWidth = Math.min(Math.max(width, minWidth), maxWidth);
      
      // Update sidebar width using CSS custom property
      document.documentElement.style.setProperty('--sidebar-width', clampedWidth + 'px');
      
      // Update graph width and simulation center
      this.width = document.getElementById('graph').clientWidth;
      this.svg.attr('width', this.width);
      this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
      this.simulation.alpha(0.1).restart();
      
      e.preventDefault();
    });
    
    // Mouse up anywhere in document
    document.addEventListener('mouseup', () => {
      if (!isResizing) return;
      
      isResizing = false;
      sidebar.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Save the width to localStorage
      const currentWidth = getComputedStyle(sidebar).width;
      localStorage.setItem('sidebarWidth', currentWidth);
    });
    
    // Load saved width from localStorage
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
      document.documentElement.style.setProperty('--sidebar-width', savedWidth);
    }
  }
  
  async loadDynamicTypes() {
    try {
      // Load all available component types
      const componentTypesResponse = await fetch('/api/node-types');
      if (componentTypesResponse.ok) {
        const { types } = await componentTypesResponse.json();
        this.updateComponentColors(types.flat());
      }
      
      // Load all available relationship types
      const relationshipTypesResponse = await fetch('/api/relationship-types');
      if (relationshipTypesResponse.ok) {
        const { types } = await relationshipTypesResponse.json();
        this.updateRelationshipColors(types);
      }
    } catch (error) {
      console.warn('Could not load dynamic types, using defaults:', error);
    }
  }
  
  updateComponentColors(types) {
    const additionalColors = [
      '#607D8B', '#795548', '#E91E63', '#673AB7', '#3F51B5',
      '#009688', '#FFC107', '#FF5722', '#9C27B0', '#00BCD4'
    ];
    
    let colorIndex = 0;
    types.forEach(type => {
      if (!this.componentColors[type]) {
        this.componentColors[type] = additionalColors[colorIndex % additionalColors.length];
        colorIndex++;
      }
    });
  }
  
  updateRelationshipColors(types) {
    const additionalColors = [
      '#424242', '#FF6F00', '#1B5E20', '#4A148C', '#B71C1C',
      '#006064', '#F57F17', '#BF360C', '#4A148C', '#01579B'
    ];
    
    let colorIndex = 0;
    types.forEach(type => {
      if (!this.relationshipColors[type]) {
        this.relationshipColors[type] = additionalColors[colorIndex % additionalColors.length];
        colorIndex++;
      }
    });
  }
  
  async loadData() {
    try {
      // Always fetch all data for client-side filtering
      const response = await fetch('/api/graph');
      this.data = await response.json();
      
      // Load available codebases for selector
      this.loadCodebases();
      
      this.updateFilters();
      this.applyFilters();
      this.updateGraph();
      this.updateStatistics();
      this.updateLegend();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }
  
  async loadCodebases() {
    try {
      const response = await fetch('/api/components');
      const components = await response.json();
      const codebases = [...new Set(components.map(c => c.codebase).filter(Boolean))];
      
      this.populateCodebaseMultiSelect(codebases.sort());
    } catch (error) {
      console.error('Error loading codebases:', error);
    }
  }

  populateCodebaseMultiSelect(codebases) {
    const container = document.getElementById('codebaseOptions');
    if (!container) return;
    
    // Keep the "All Codebases" option, add individual codebase options
    codebases.forEach(codebase => {
      const label = document.createElement('label');
      label.className = 'checkbox-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = codebase;
      checkbox.addEventListener('change', () => this.handleCodebaseSelection());
      
      const span = document.createElement('span');
      span.textContent = codebase;
      
      label.appendChild(checkbox);
      label.appendChild(span);
      container.appendChild(label);
    });
  }

  setupMultiSelectCodebase() {
    const btn = document.getElementById('codebaseSelectBtn');
    const dropdown = document.getElementById('codebaseSelectDropdown');
    const allOption = document.getElementById('allCodebasesOption');
    
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
    
    // Handle "All Codebases" option
    allOption.addEventListener('change', () => {
      if (allOption.checked) {
        // Uncheck all other options
        const otherOptions = dropdown.querySelectorAll('input[type="checkbox"]:not(#allCodebasesOption)');
        otherOptions.forEach(option => option.checked = false);
        this.filters.selectedCodebases.clear();
      }
      this.updateCodebaseButtonText();
      this.applyFilters();
      this.updateGraph();
    });
  }
  
  handleCodebaseSelection() {
    const allOption = document.getElementById('allCodebasesOption');
    const otherOptions = document.querySelectorAll('#codebaseOptions input[type="checkbox"]:not(#allCodebasesOption)');
    const selectedOptions = [...otherOptions].filter(option => option.checked);
    
    if (selectedOptions.length > 0) {
      // If any specific codebase is selected, uncheck "All Codebases"
      if (allOption) allOption.checked = false;
      this.filters.selectedCodebases = new Set(selectedOptions.map(option => option.value));
    } else {
      // If no specific codebase is selected, check "All Codebases"
      if (allOption) allOption.checked = true;
      this.filters.selectedCodebases.clear();
    }
    
    this.updateCodebaseButtonText();
    this.applyFilters();
    this.updateGraph();
  }
  
  updateCodebaseButtonText() {
    const textSpan = document.getElementById('codebaseSelectText');
    if (!textSpan) return;
    
    if (this.filters.selectedCodebases.size === 0) {
      textSpan.textContent = 'All Codebases';
    } else if (this.filters.selectedCodebases.size === 1) {
      textSpan.textContent = [...this.filters.selectedCodebases][0];
    } else {
      textSpan.textContent = `${this.filters.selectedCodebases.size} Codebases`;
    }
  }
  
  updateFilters() {
    const componentTypes = new Set();
    const relationshipTypes = new Set();
    const taskStatuses = new Set();
    
    this.data.nodes.forEach(node => {
      if (node.type === 'component') {
        // For components, look for the actual component type in node properties
        // The server sends nodes with type:'component' but the actual type (FILE, CLASS) as a separate field
        const componentType = node.componentType || node.type;
        if (componentType in this.componentColors) {
          componentTypes.add(componentType);
        }
      } else if (node.type === 'task' && node.status) {
        taskStatuses.add(node.status);
      }
    });
    
    this.data.links.forEach(link => {
      relationshipTypes.add(link.type);
    });
    
    this.createFilterCheckboxes('componentTypeFilters', componentTypes, 'componentTypes');
    this.createFilterCheckboxes('relationshipTypeFilters', relationshipTypes, 'relationshipTypes');
    this.createFilterCheckboxes('taskStatusFilters', taskStatuses, 'taskStatuses');
  }
  
  createFilterCheckboxes(containerId, items, filterType) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'checkbox-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `${filterType}_${item}`;
      checkbox.checked = true;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.filters[filterType].delete(item);
        } else {
          this.filters[filterType].add(item);
        }
        this.applyFilters();
        this.updateGraph();
      });
      
      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.textContent = item;
      
      div.appendChild(checkbox);
      div.appendChild(label);
      container.appendChild(div);
    });
  }
  
  applyFilters() {
    this.filteredData.nodes = this.data.nodes.filter(node => {
      // Filter by selected codebases
      if (this.filters.selectedCodebases.size > 0 && node.codebase && !this.filters.selectedCodebases.has(node.codebase)) {
        return false;
      }
      
      if (node.type === 'component') {
        const componentType = node.componentType || node.type;
        return !this.filters.componentTypes.has(componentType);
      } else if (node.type === 'task') {
        return !this.filters.taskStatuses.has(node.status);
      }
      return true;
    });
    
    const nodeIds = new Set(this.filteredData.nodes.map(n => n.id));
    this.filteredData.links = this.data.links.filter(link => {
      return nodeIds.has(link.source.id || link.source) && 
             nodeIds.has(link.target.id || link.target) &&
             !this.filters.relationshipTypes.has(link.type);
    });
  }
  
  updateGraph() {
    // Clear existing elements
    this.container.selectAll('*').remove();
    
    // Create arrow markers for directed relationships
    this.container.append('defs').selectAll('marker')
      .data(Object.keys(this.relationshipColors))
      .enter().append('marker')
      .attr('id', d => `arrow-${d}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .style('fill', d => this.relationshipColors[d]);
    
    // Links
    this.link = this.container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(this.filteredData.links)
      .enter().append('line')
      .attr('class', d => `link link-${d.type}`)
      .style('stroke', d => this.relationshipColors[d.type] || '#999')
      .attr('marker-end', d => `url(#arrow-${d.type})`);
    
    // Nodes
    this.node = this.container.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(this.filteredData.nodes)
      .enter().append('circle')
      .attr('class', d => `node node-${d.type === 'component' ? (d.componentType || 'component') : (d.status || 'task')}`)
      .attr('r', d => d.type === 'task' ? 8 : 6)
      .style('fill', d => this.getNodeColor(d))
      .on('click', (event, d) => this.selectNode(d))
      .on('mouseover', (event, d) => this.showTooltip(event, d))
      .on('mouseout', () => this.hideTooltip())
      .call(this.drag());
    
    // Labels
    this.label = this.container.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(this.filteredData.nodes)
      .enter().append('text')
      .attr('class', 'node-label')
      .text(d => d.name)
      .style('font-size', '10px')
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'middle')
      .style('pointer-events', 'none');
    
    // Update simulation
    this.simulation.nodes(this.filteredData.nodes);
    this.simulation.force('link').links(this.filteredData.links);
    this.simulation.on('tick', () => this.tick());
    this.simulation.alpha(1).restart();
  }
  
  getNodeColor(d) {
    if (d.type === 'component') {
      const componentType = d.componentType || d.type;
      return this.componentColors[componentType] || '#999';
    } else if (d.type === 'task') {
      return this.taskColors[d.status] || '#FFC107';
    }
    return '#999';
  }
  
  tick() {
    this.link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
      
    this.node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);
      
    this.label
      .attr('x', d => d.x)
      .attr('y', d => d.y + 20);
  }
  
  drag() {
    return d3.drag()
      .on('start', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }
  
  selectNode(node) {
    // Clear previous selection
    this.node.classed('selected', false);
    this.link.classed('highlighted', false);
    
    this.selectedNode = node;
    
    // Highlight selected node
    this.node.filter(d => d.id === node.id).classed('selected', true);
    
    // Highlight connected links
    this.link.filter(d => 
      d.source.id === node.id || d.target.id === node.id
    ).classed('highlighted', true);
    
    this.updateSelectionInfo(node);
  }
  
  async loadNodeComments(nodeId) {
    try {
      const response = await fetch(`/api/nodes/${nodeId}/comments`);
      if (!response.ok) {
        throw new Error('Failed to load comments');
      }
      const comments = await response.json();
      if (!comments.length) return '<p>No comments yet.</p>';
    
      let commentsHtml = '<div class="comments-section">';
      commentsHtml += '<h5>💬 Comments</h5>';
    
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

      commentsHtml += '</div>';
      return commentsHtml;
    } catch (error) {
      console.error('Error fetching comments:', error);
      return '<p>Error loading comments.</p>';
    }
  }

  renderMarkdown(text) {
    if (!text || typeof text !== 'string') {
      return text || '';
    }
    
    try {
      // Configure marked with safe defaults and syntax highlighting
      if (typeof marked !== 'undefined') {
        const renderer = new marked.Renderer();
        
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

  formatMetadata(node) {
    // Get all properties of the node, excluding basic fields already shown
    const excludedFields = new Set([
      'id', 'name', 'type', 'componentType', 'codebase', 'path', 
      'description', 'status', 'progress', 'x', 'y', 'fx', 'fy', 
      'index', 'vx', 'vy'
    ]);
    
    const metadataEntries = [];
    
    // Collect all extra properties
    for (const [key, value] of Object.entries(node)) {
      if (!excludedFields.has(key) && value !== null && value !== undefined && value !== '') {
        metadataEntries.push([key, value]);
      }
    }
    
    if (metadataEntries.length === 0) {
      return '';
    }
    
    let metadataHtml = '<div class="metadata-section">';
    metadataHtml += '<h5>📋 Additional Metadata</h5>';
    
    metadataEntries.forEach(([key, value]) => {
      // Format key to be more readable
      const displayKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
        .split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      
      let displayValue;
      if (typeof value === 'object') {
        // For objects/arrays, show pretty JSON
        displayValue = `<pre class="metadata-json">${JSON.stringify(value, null, 2)}</pre>`;
      } else if (typeof value === 'string' && value.includes(',')) {
        // For comma-separated strings, show as a list
        const items = value.split(',').map(item => item.trim()).filter(item => item);
        if (items.length > 1) {
          displayValue = '<ul class="metadata-list">' + 
            items.map(item => `<li>${item}</li>`).join('') + 
            '</ul>';
        } else {
          displayValue = value;
        }
      } else {
        displayValue = String(value);
      }
      
      metadataHtml += `
        <div class="metadata-item">
          <span class="metadata-key">${displayKey}:</span>
          <div class="metadata-value">${displayValue}</div>
        </div>
      `;
    });
    
    metadataHtml += '</div>';
    return metadataHtml;
  }

  async updateSelectionInfo(node) {
    const info = document.getElementById('selectionInfo');
    
    if (!node) {
      info.innerHTML = '<p>Click on a node to see details</p>';
      return;
    }
    
    let relationshipsHtml = '';
    if (node.type === 'component') {
      try {
        const response = await fetch(`/api/components/${node.id}/relationships`);
        if (response.ok) {
          const relationships = await response.json();
          if (relationships && relationships.length > 0) {
            const groupedRelationships = this.groupRelationships(relationships);
            relationshipsHtml = '<div class="relationships-section">';
            relationshipsHtml += '<h5>🔗 Relationships</h5>';
            
            Object.entries(groupedRelationships).forEach(([relType, rels]) => {
              relationshipsHtml += `<div class="relationship-group">`;
              relationshipsHtml += `<h6 style="color: ${this.relationshipColors[relType] || '#999'}">${relType} (${rels.length})</h6>`;
              
              rels.slice(0, 5).forEach(rel => {
                const arrow = rel.direction === 'outgoing' ? '→' : '←';
                relationshipsHtml += `<div class="relationship-item">`;
                relationshipsHtml += `<span class="relationship-direction">${arrow}</span>`;
                relationshipsHtml += `<span class="relationship-target clickable" data-node-id="${rel.target.id}" title="Click to select and focus this node. ${rel.target.description || ''}">${rel.target.name}</span>`;
                relationshipsHtml += `</div>`;
              });
              
              if (rels.length > 5) {
                relationshipsHtml += `<div class="relationship-more">... and ${rels.length - 5} more</div>`;
              }
              relationshipsHtml += `</div>`;
            });
            relationshipsHtml += '</div>';
          }
        }
      } catch (error) {
        console.warn('Could not load relationships for node:', error);
      }
    }
    
    // Load comments for this node
    const commentsHtml = await this.loadNodeComments(node.id);
    
    const html = `
      <h4>${node.name}</h4>
      <div class="info-item">
        <span class="info-label">Type:</span>
        <span>${node.type}</span>
      </div>
      ${node.type === 'component' ? `
        <div class="info-item">
          <span class="info-label">Component Type:</span>
          <span>${node.componentType || node.type}</span>
        </div>
        ${node.codebase ? `
          <div class="info-item">
            <span class="info-label">Codebase:</span>
            <span>${node.codebase}</span>
          </div>
        ` : ''}
        ${node.path ? `
          <div class="info-item">
            <span class="info-label">Path:</span>
            <span>${node.path}</span>
          </div>
        ` : ''}
      ` : ''}
      ${node.type === 'task' ? `
        <div class="info-item">
          <span class="info-label">Status:</span>
          <span>${node.status}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Progress:</span>
          <span>${Math.round(node.progress * 100)}%</span>
        </div>
      ` : ''}
      ${node.description ? `
        <div class="info-item">
          <span class="info-label">Description:</span>
          <div class="markdown-content">${this.renderMarkdown(node.description)}</div>
        </div>
      ` : ''}
      ${this.formatMetadata(node)}
      ${relationshipsHtml}
      ${commentsHtml}
    `;
    
    info.innerHTML = html;
    
    // Add event listeners for clickable relationship targets
    info.querySelectorAll('.relationship-target.clickable').forEach(target => {
      target.addEventListener('click', (e) => {
        e.preventDefault();
        const nodeId = e.target.getAttribute('data-node-id');
        this.selectAndFocusNodeById(nodeId);
      });
    });
  }
  
  groupRelationships(relationships) {
    const grouped = {};
    relationships.forEach(rel => {
      if (!grouped[rel.type]) {
        grouped[rel.type] = [];
      }
      grouped[rel.type].push(rel);
    });
    return grouped;
  }
  
  showTooltip(event, node) {
    this.tooltip
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px')
      .classed('visible', true)
      .html(`
        <strong>${node.name}</strong><br>
        ${node.type === 'component' ? `Type: ${node.componentType || node.type}` : `Status: ${node.status}`}<br>
        ${node.description ? node.description : ''}
      `);
  }
  
  hideTooltip() {
    this.tooltip.classed('visible', false);
  }
  
  centerGraph() {
    const transform = d3.zoomIdentity;
    this.svg.transition().duration(750).call(
      d3.zoom().transform,
      transform
    );
  }
  
  exportData() {
    const dataStr = JSON.stringify(this.data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'codebase-graph.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  updateStatistics() {
    const stats = this.data.statistics || {
      componentCount: this.data.nodes.filter(n => n.type === 'component').length,
      taskCount: this.data.nodes.filter(n => n.type === 'task').length,
      relationshipCount: this.data.links.length
    };
    
    document.getElementById('componentCount').textContent = stats.componentCount;
    document.getElementById('taskCount').textContent = stats.taskCount;
    document.getElementById('relationshipCount').textContent = stats.relationshipCount;
  }
  
  updateLegend() {
    // Component types legend
    const componentLegend = document.getElementById('componentLegend');
    componentLegend.innerHTML = '';
    
    Object.entries(this.componentColors).forEach(([type, color]) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <div class="legend-color" style="background-color: ${color}"></div>
        <span>${type}</span>
      `;
      componentLegend.appendChild(item);
    });
    
    // Task status legend
    Object.entries(this.taskColors).forEach(([status, color]) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <div class="legend-color" style="background-color: ${color}"></div>
        <span>${status} (Task)</span>
      `;
      componentLegend.appendChild(item);
    });
    
    // Relationship types legend
    const relationshipLegend = document.getElementById('relationshipLegend');
    relationshipLegend.innerHTML = '';
    
    Object.entries(this.relationshipColors).forEach(([type, color]) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <div class="legend-line" style="background-color: ${color}"></div>
        <span>${type}</span>
      `;
      relationshipLegend.appendChild(item);
    });
  }

  checkHighlightParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const highlightId = urlParams.get('highlight');
    
    if (highlightId) {
      // Wait for data to load then highlight the node with smooth animation
      setTimeout(() => this.highlightNodeWithAnimation(highlightId), 1000);
    }
  }
  
  highlightNodeWithAnimation(nodeId) {
    if (!this.filteredData.nodes || this.filteredData.nodes.length === 0) {
      // Data not loaded yet, try again later
      setTimeout(() => this.highlightNodeWithAnimation(nodeId), 500);
      return;
    }
    
    const nodeToHighlight = this.filteredData.nodes.find(node => node.id === nodeId);
    if (!nodeToHighlight) {
      // Check if node exists but is filtered out
      const hiddenNode = this.data.nodes.find(node => node.id === nodeId);
      if (hiddenNode) {
        console.warn(`Node "${hiddenNode.name}" is currently hidden by filters`);
        // Show a subtle notification instead of an alert
        this.showNotification(`Node "${hiddenNode.name}" is currently hidden by filters. Adjust filters to see it.`, 'warning');
      } else {
        console.warn(`Node with ID ${nodeId} not found`);
        this.showNotification(`Node with ID ${nodeId} not found.`, 'error');
      }
      return;
    }
    
    // First, select the node
    this.selectNode(nodeToHighlight);
    
    // Wait for the node to have position data from simulation
    const animateToNode = () => {
      if (nodeToHighlight.x && nodeToHighlight.y) {
        // Calculate the transform to center the node with some zoom
        const scale = 1.5;
        const translateX = this.width / 2 - nodeToHighlight.x * scale;
        const translateY = this.height / 2 - nodeToHighlight.y * scale;
        
        const transform = d3.zoomIdentity
          .translate(translateX, translateY)
          .scale(scale);
        
        // Smooth animated transition to center the node
        this.svg.transition()
          .duration(1500)
          .ease(d3.easeCubicInOut)
          .call(
            d3.zoom().transform,
            transform
          );
          
        // Add pulsing highlight effect
        setTimeout(() => {
          this.addPulsingEffect(nodeId);
        }, 500);
      } else {
        // Node doesn't have position yet, wait a bit more
        setTimeout(animateToNode, 100);
      }
    };
    
    // Start the animation after a short delay
    setTimeout(animateToNode, 300);
  }
  
  addPulsingEffect(nodeId) {
    const targetNode = this.node.filter(d => d.id === nodeId);
    if (targetNode.empty()) return;
    
    // Create a series of pulsing animations
    const pulse = () => {
      targetNode
        .transition()
        .duration(600)
        .ease(d3.easeQuadInOut)
        .style('stroke', '#ff6b6b')
        .style('stroke-width', '6px')
        .transition()
        .duration(600)
        .ease(d3.easeQuadInOut)
        .style('stroke-width', '4px')
        .on('end', function(d, i) {
          // Only continue pulsing for the first node in the selection
          if (i === 0) {
            setTimeout(pulse, 200);
          }
        });
    };
    
    // Start pulsing and stop after a few cycles
    pulse();
    setTimeout(() => {
      targetNode
        .transition()
        .duration(400)
        .style('stroke', '#ff6b6b')
        .style('stroke-width', '4px');
    }, 3000);
  }
  
  showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'notification';
      notification.className = 'notification';
      document.body.appendChild(notification);
    }
    
    // Set message and type
    notification.textContent = message;
    notification.className = `notification ${type} visible`;
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      notification.classList.remove('visible');
    }, 4000);
  }

  selectAndFocusNodeById(nodeId) {
    if (!this.filteredData.nodes || this.filteredData.nodes.length === 0) {
      console.warn('No nodes available to select from');
      return;
    }
    
    // First, try to find the node in filtered data
    let nodeToSelect = this.filteredData.nodes.find(node => node.id === nodeId);
    
    // If not found in filtered data, check if it's in the full dataset but filtered out
    if (!nodeToSelect) {
      nodeToSelect = this.data.nodes.find(node => node.id === nodeId);
      if (nodeToSelect) {
        // Node exists but is filtered out - show a message
        alert(`The node "${nodeToSelect.name}" is currently hidden by filters. Please adjust your filters to see this node.`);
        return;
      } else {
        console.warn(`Node with ID ${nodeId} not found`);
        return;
      }
    }
    
    // Select the node
    this.selectNode(nodeToSelect);
    
    // Center the view on this node with animation
    setTimeout(() => {
      if (nodeToSelect.x && nodeToSelect.y) {
        const transform = d3.zoomIdentity
          .translate(this.width / 2 - nodeToSelect.x, this.height / 2 - nodeToSelect.y)
          .scale(1.2);
        
        this.svg.transition().duration(750).call(
          d3.zoom().transform,
          transform
        );
      }
    }, 200);
    
    // Add pulsing effect to highlight the node
    this.node.filter(d => d.id === nodeId)
      .style('stroke', '#ff6b6b')
      .style('stroke-width', '4px')
      .transition()
      .duration(500)
      .style('stroke-width', '6px')
      .transition()
      .duration(500)
      .style('stroke-width', '4px');
  }
  
  highlightNode(nodeId) {
    if (!this.filteredData.nodes || this.filteredData.nodes.length === 0) {
      // Data not loaded yet, try again later
      setTimeout(() => this.highlightNode(nodeId), 500);
      return;
    }
    
    // Use the new method for consistency
    this.selectAndFocusNodeById(nodeId);
  }
}

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new GraphVisualizer();
});
