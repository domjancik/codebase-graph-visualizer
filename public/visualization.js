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
    
    // Color schemes
    this.componentColors = {
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
    
    this.relationshipColors = {
      'DEPENDS_ON': '#F44336',
      'IMPLEMENTS': '#4CAF50',
      'EXTENDS': '#FF9800',
      'CONTAINS': '#2196F3',
      'CALLS': '#9C27B0',
      'IMPORTS': '#00BCD4',
      'EXPORTS': '#8BC34A',
      'OVERRIDES': '#795548',
      'USES': '#607D8B',
      'CREATES': '#E91E63'
    };
    
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
      taskStatuses: new Set()
    };
    
    this.initializeEventListeners();
    this.loadData();
    
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
    
    // Codebase selector
    document.getElementById('codebaseSelect').addEventListener('change', (e) => {
      this.loadData(e.target.value);
    });
    
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
  
  async loadData(codebase = '') {
    try {
      const url = codebase ? `/api/graph/${codebase}` : '/api/graph';
      const response = await fetch(url);
      this.data = await response.json();
      
      // Load available codebases for selector
      if (!codebase) {
        this.loadCodebases();
      }
      
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
      
      const select = document.getElementById('codebaseSelect');
      select.innerHTML = '<option value="">All Codebases</option>';
      codebases.forEach(codebase => {
        const option = document.createElement('option');
        option.value = codebase;
        option.textContent = codebase;
        select.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading codebases:', error);
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
  
  updateSelectionInfo(node) {
    const info = document.getElementById('selectionInfo');
    
    if (!node) {
      info.innerHTML = '<p>Click on a node to see details</p>';
      return;
    }
    
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
          <span>${node.description}</span>
        </div>
      ` : ''}
    `;
    
    info.innerHTML = html;
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
      // Wait for data to load then highlight the node
      setTimeout(() => this.highlightNode(highlightId), 1000);
    }
  }

  highlightNode(nodeId) {
    if (!this.filteredData.nodes || this.filteredData.nodes.length === 0) {
      // Data not loaded yet, try again later
      setTimeout(() => this.highlightNode(nodeId), 500);
      return;
    }
    
    const nodeToHighlight = this.filteredData.nodes.find(node => node.id === nodeId);
    if (nodeToHighlight) {
      // Select the node
      this.selectNode(nodeToHighlight);
      
      // Center the view on this node
      setTimeout(() => {
        if (nodeToHighlight.x && nodeToHighlight.y) {
          const transform = d3.zoomIdentity
            .translate(this.width / 2 - nodeToHighlight.x, this.height / 2 - nodeToHighlight.y)
            .scale(1.5);
          
          this.svg.transition().duration(750).call(
            d3.zoom().transform,
            transform
          );
        }
      }, 500);
      
      // Add pulsing effect
      this.node.filter(d => d.id === nodeId)
        .style('stroke', '#ff0000')
        .style('stroke-width', '3px')
        .transition()
        .duration(1000)
        .style('stroke-width', '6px')
        .transition()
        .duration(1000)
        .style('stroke-width', '3px');
    }
  }
}

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new GraphVisualizer();
});
