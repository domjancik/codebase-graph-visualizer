class DesignDocsVisualization {
    constructor() {
        this.designCanvas = document.getElementById('designCanvas');
        this.svg = null;
        this.data = { nodes: [], links: [] };
        this.filteredData = { nodes: [], links: [] };
        this.selectedNode = null;
        
        // Configuration
        this.config = {
            nodeWidth: 300,
            nodeHeight: 200,
            gridSize: 200,
            nodeGap: 50,
            canvasPadding: 100  // Padding around the entire canvas
        };
        
        // Document type colors
        this.docTypeColors = {
            'SPECIFICATION': '#2196F3',
            'REQUIREMENT': '#9C27B0',
            'FEATURE': '#4CAF50',
            'USER_STORY': '#FF9800',
            'ACCEPTANCE_CRITERIA': '#E91E63'
        };
        
        // Connection type colors
        this.connectionColors = {
            'DEPENDS_ON': '#F44336',
            'IMPLEMENTS': '#4CAF50',
            'EXTENDS': '#FF9800',
            'CONTAINS': '#2196F3',
            'DERIVES_FROM': '#9C27B0',
            'REFINES': '#00BCD4',
            'TRACES_TO': '#795548',
            'VALIDATES': '#607D8B',
            'VERIFIES': '#E91E63',
            'PRECEDES': '#8E24AA',
            'FOLLOWS': '#5C6BC0',
            'CONCURRENT': '#26A69A'
        };
        
        // Filters for time and probability
        this.filters = {
            showTimeLabels: true,
            showProbabilityLabels: true,
            minProbability: 0,
            maxProbability: 100,
            timeOrderFilter: 'all', // all, chronological, reverse
            selectedCodebase: '',
            selectedProject: '',
            docTypeFilters: new Set(),
            connectionTypeFilters: new Set()
        };
        
        this.initializeVisualization();
        this.setupEventListeners();
        this.loadCodebaseOptions().then(() => {
            this.loadData();
        });
    }
    
    initializeVisualization() {
        // Create SVG for connections
        this.svg = d3.select(this.designCanvas)
            .append('svg')
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('width', '100%')
            .style('height', '100%')
            .style('pointer-events', 'none')
            .style('z-index', '1');
            
        // Add arrow markers for connections
        const defs = this.svg.append('defs');
        
        // Create arrow marker
        const arrowMarker = defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .attr('class', 'arrow-marker');
            
        arrowMarker.append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#999');
    }
    
    setupEventListeners() {
        // Layout controls
        document.getElementById('gridSize')?.addEventListener('input', (e) => {
            this.config.gridSize = parseInt(e.target.value);
            this.updateLayout();
        });
        
        document.getElementById('nodeWidth')?.addEventListener('input', (e) => {
            this.config.nodeWidth = parseInt(e.target.value);
            this.updateLayout();
        });
        
        document.getElementById('nodeHeight')?.addEventListener('input', (e) => {
            this.config.nodeHeight = parseInt(e.target.value);
            this.updateLayout();
        });
        
        document.getElementById('nodeGap')?.addEventListener('input', (e) => {
            this.config.nodeGap = parseInt(e.target.value);
            this.updateLayout();
        });
        
        // Refresh button
        document.getElementById('refreshBtn')?.addEventListener('click', () => {
            this.loadData();
        });
        
        // Center button
        document.getElementById('centerBtn')?.addEventListener('click', () => {
            this.centerView();
        });
        
        // Export button
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            this.exportData();
        });
        
        // Time and probability filter controls
        document.getElementById('showTimeLabels')?.addEventListener('change', (e) => {
            this.filters.showTimeLabels = e.target.checked;
            this.renderVisualization();
        });
        
        document.getElementById('showProbabilityLabels')?.addEventListener('change', (e) => {
            this.filters.showProbabilityLabels = e.target.checked;
            this.renderVisualization();
        });
        
        document.getElementById('minProbability')?.addEventListener('input', (e) => {
            this.filters.minProbability = parseInt(e.target.value);
            document.getElementById('minProbText').textContent = e.target.value + '%';
            this.renderVisualization();
        });
        
        document.getElementById('maxProbability')?.addEventListener('input', (e) => {
            this.filters.maxProbability = parseInt(e.target.value);
            document.getElementById('maxProbText').textContent = e.target.value + '%';
            this.renderVisualization();
        });
        
        document.getElementById('timeOrderFilter')?.addEventListener('change', (e) => {
            this.filters.timeOrderFilter = e.target.value;
            this.applyTimeOrderFilter();
            this.renderVisualization();
        });
        
        // Codebase selector
        document.getElementById('codebaseSelect')?.addEventListener('change', (e) => {
            this.filters.selectedCodebase = e.target.value;
            this.loadData();
        });
    }
    
    async loadData() {
        try {
            // Show loading
            this.showLoading(true);
            
            // Use codebase-specific endpoint if a codebase is selected
            const url = this.filters.selectedCodebase 
                ? `/api/design-docs/${this.filters.selectedCodebase}` 
                : '/api/design-docs';
            const response = await fetch(url);
            const { nodes, links } = await response.json();
            
            this.data.nodes = nodes;
            this.data.links = links;
            
            // Apply filters
            this.applyFilters();
            
            this.renderVisualization();
            this.updateStatistics();
            this.updateLegend();
            this.updateFilterOptions();
            
        } catch (error) {
            console.error('Error loading design docs:', error);
        } finally {
            this.showLoading(false);
        }
    }
    
    async loadCodebaseOptions() {
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
            console.error('Error loading codebase options:', error);
        }
    }
    
    applyFilters() {
        let filteredNodes = [...this.data.nodes];
        let filteredLinks = [...this.data.links];
        
        // Filter by document types
        if (this.filters.docTypeFilters.size > 0) {
            filteredNodes = filteredNodes.filter(node => 
                this.filters.docTypeFilters.has(node.componentType)
            );
        }
        
        // Filter by project if specified
        if (this.filters.selectedProject) {
            filteredNodes = filteredNodes.filter(node => 
                node.metadata?.project === this.filters.selectedProject
            );
        }
        
        // Filter links to only include connections between filtered nodes
        const nodeIds = new Set(filteredNodes.map(n => n.id));
        filteredLinks = filteredLinks.filter(link => 
            nodeIds.has(link.source) && nodeIds.has(link.target)
        );
        
        // Filter by connection types
        if (this.filters.connectionTypeFilters.size > 0) {
            filteredLinks = filteredLinks.filter(link => 
                this.filters.connectionTypeFilters.has(link.type)
            );
        }
        
        this.filteredData = { nodes: filteredNodes, links: filteredLinks };
    }
    
    updateFilterOptions() {
        // Update document type filters
        const docTypes = new Set();
        this.data.nodes.forEach(node => {
            if (node.componentType) {
                docTypes.add(node.componentType);
            }
        });
        this.createFilterCheckboxes('docTypeFilters', docTypes, 'docTypeFilters');
        
        // Update connection type filters
        const connectionTypes = new Set();
        this.data.links.forEach(link => {
            connectionTypes.add(link.type);
        });
        this.createFilterCheckboxes('connectionTypeFilters', connectionTypes, 'connectionTypeFilters');
        
        // Update project options if available
        const projects = new Set();
        this.data.nodes.forEach(node => {
            if (node.metadata?.project) {
                projects.add(node.metadata.project);
            }
        });
        
        if (projects.size > 0) {
            this.updateProjectFilter(projects);
        }
    }
    
    createFilterCheckboxes(containerId, options, filterType) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        options.forEach(option => {
            const label = document.createElement('label');
            label.className = 'checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = option;
            checkbox.checked = true; // Default to showing all
            
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.filters[filterType].add(option);
                } else {
                    this.filters[filterType].delete(option);
                }
                this.applyFilters();
                this.renderVisualization();
                this.updateStatistics();
            });
            
            // Initialize filter set
            this.filters[filterType].add(option);
            
            const span = document.createElement('span');
            span.textContent = option.replace('_', ' ');
            
            label.appendChild(checkbox);
            label.appendChild(span);
            container.appendChild(label);
        });
    }
    
    updateProjectFilter(projects) {
        // Check if project filter already exists
        let projectContainer = document.getElementById('projectFilterContainer');
        if (!projectContainer) {
            // Create project filter section
            const filtersDiv = document.getElementById('filters');
            const filterGroup = document.createElement('div');
            filterGroup.className = 'filter-group';
            filterGroup.id = 'projectFilterContainer';
            
            const label = document.createElement('label');
            label.textContent = 'Project:';
            
            const select = document.createElement('select');
            select.id = 'projectSelect';
            select.addEventListener('change', (e) => {
                this.filters.selectedProject = e.target.value;
                this.applyFilters();
                this.renderVisualization();
                this.updateStatistics();
            });
            
            filterGroup.appendChild(label);
            filterGroup.appendChild(select);
            filtersDiv.appendChild(filterGroup);
            
            projectContainer = filterGroup;
        }
        
        const select = document.getElementById('projectSelect');
        select.innerHTML = '<option value="">All Projects</option>';
        
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            select.appendChild(option);
        });
    }
    
    renderVisualization() {
        // Clear existing content
        const existingNodes = this.designCanvas.querySelectorAll('.doc-node');
        existingNodes.forEach(node => node.remove());
        
        // Clear SVG
        this.svg.selectAll('*').remove();
        
        // Re-add defs and arrow marker
        const defs = this.svg.append('defs');
        const arrowMarker = defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .attr('class', 'arrow-marker');
            
        arrowMarker.append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#999');
        
        // Render nodes
        this.filteredData.nodes.forEach(node => this.createNodeElement(node));
        
        // Render connections
        this.filteredData.links.forEach(link => this.createConnectionElement(link));
    }
    
    createNodeElement(node) {
        const nodeDiv = document.createElement('div');
        let className = `doc-node doc-type-${node.componentType?.toLowerCase() || 'unknown'}`;
        
        // Add 'wide' class for nodes 300px or wider to enable horizontal header layout
        if (this.config.nodeWidth >= 300) {
            className += ' wide';
        }
        
        nodeDiv.className = className;
        nodeDiv.style.position = 'absolute';
        nodeDiv.style.top = node.position.y + 'px';
        nodeDiv.style.left = node.position.x + 'px';
        nodeDiv.style.width = this.config.nodeWidth + 'px';
        nodeDiv.style.height = this.config.nodeHeight + 'px';
        nodeDiv.style.zIndex = '10';
        nodeDiv.setAttribute('data-node-id', node.id);
        
        // Header
        const header = document.createElement('div');
        header.className = 'doc-node-header';
        
        const title = document.createElement('h4');
        title.className = 'doc-node-title';
        title.textContent = node.name || 'Untitled';
        
        const typeBadge = document.createElement('span');
        typeBadge.className = 'doc-node-type';
        typeBadge.textContent = (node.componentType || 'UNKNOWN').replace('_', ' ');
        
        header.appendChild(title);
        header.appendChild(typeBadge);
        
        // Content
        const content = document.createElement('div');
        content.className = 'doc-node-content';
        
        // Use simple text rendering instead of markdown for now
        const description = node.description || 'No description available';
        if (typeof marked !== 'undefined' && marked.parse) {
            content.innerHTML = marked.parse(description);
        } else {
            // Fallback: simple text with basic formatting
            content.innerHTML = this.formatText(description);
        }
        
        nodeDiv.appendChild(header);
        nodeDiv.appendChild(content);
        
        // Add click event
        nodeDiv.addEventListener('click', () => this.selectNode(node));
        
        this.designCanvas.appendChild(nodeDiv);
    }
    
    formatText(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }
    
    createConnectionElement(link) {
        const sourceNode = this.filteredData.nodes.find(n => n.id === link.source);
        const targetNode = this.filteredData.nodes.find(n => n.id === link.target);
        
        if (!sourceNode || !targetNode) return;
        
        // Filter by probability if specified
        if (link.probability !== undefined && 
            (link.probability < this.filters.minProbability || link.probability > this.filters.maxProbability)) {
            return;
        }
        
        // Calculate connection points
        const sourceX = sourceNode.position.x + this.config.nodeWidth / 2;
        const sourceY = sourceNode.position.y + this.config.nodeHeight / 2;
        const targetX = targetNode.position.x + this.config.nodeWidth / 2;
        const targetY = targetNode.position.y + this.config.nodeHeight / 2;
        
        // Create orthogonal path (90-degree turns)
        const path = this.createOrthogonalPath(sourceX, sourceY, targetX, targetY);
        
        // Style connection based on probability
        let strokeWidth = '2px';
        let strokeOpacity = 1;
        if (link.probability !== undefined) {
            strokeWidth = `${Math.max(1, Math.floor(link.probability / 25) + 1)}px`;
            strokeOpacity = Math.max(0.3, link.probability / 100);
        }
        
        const connection = this.svg.append('path')
            .attr('d', path)
            .attr('class', `connection-line connection-${link.type.toLowerCase()}`)
            .attr('marker-end', 'url(#arrowhead)')
            .style('stroke', this.connectionColors[link.type] || '#999')
            .style('stroke-width', strokeWidth)
            .style('stroke-opacity', strokeOpacity)
            .style('fill', 'none');
        
        // Add main label
        const midX = (sourceX + targetX) / 2;
        const midY = (sourceY + targetY) / 2;
        
        // Build label text with optional time and probability
        let labelText = link.type.replace('_', ' ');
        const additionalLabels = [];
        
        if (this.filters.showTimeLabels && link.timeOrder) {
            additionalLabels.push(`T${link.timeOrder}`);
        }
        
        if (this.filters.showProbabilityLabels && link.probability !== undefined) {
            additionalLabels.push(`${link.probability}%`);
        }
        
        if (additionalLabels.length > 0) {
            labelText += ` (${additionalLabels.join(', ')})`;
        }
        
        this.svg.append('text')
            .attr('x', midX)
            .attr('y', midY - 5)
            .attr('class', 'connection-label')
            .style('font-size', '10px')
            .style('fill', '#666')
            .style('text-anchor', 'middle')
            .text(labelText);
            
        // Add reasoning label if present
        if (link.reasoning) {
            this.svg.append('text')
                .attr('x', midX)
                .attr('y', midY + 10)
                .attr('class', 'connection-reasoning')
                .style('font-size', '8px')
                .style('fill', '#888')
                .style('text-anchor', 'middle')
                .style('font-style', 'italic')
                .text(link.reasoning.length > 30 ? link.reasoning.substring(0, 30) + '...' : link.reasoning);
        }
    }
    
    createOrthogonalPath(x1, y1, x2, y2) {
        const midX = (x1 + x2) / 2;
        return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
    }
    
    selectNode(node) {
        // Remove previous selection
        document.querySelectorAll('.doc-node.selected').forEach(n => n.classList.remove('selected'));
        
        // Add selection to current node
        const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
        if (nodeElement) {
            nodeElement.classList.add('selected');
        }
        
        this.selectedNode = node;
        this.updateSelectionInfo(node);
    }
    
    updateSelectionInfo(node) {
        const info = document.getElementById('selectionInfo');
        if (!info || !node) return;
        
        info.innerHTML = `
            <h4>${node.name}</h4>
            <div class="info-item">
                <span class="info-label">Type:</span>
                <span>${node.componentType || 'Unknown'}</span>
            </div>
            ${node.codebase ? `
                <div class="info-item">
                    <span class="info-label">Codebase:</span>
                    <span>${node.codebase}</span>
                </div>
            ` : ''}
            ${node.description ? `
                <div class="info-item">
                    <span class="info-label">Description:</span>
                    <div class="markdown-content">${this.formatText(node.description)}</div>
                </div>
            ` : ''}
        `;
    }
    
    updateStatistics() {
        const designDocCount = this.filteredData.nodes.length;
        const connectionCount = this.filteredData.links.length;
        const featureCount = this.filteredData.nodes.filter(n => n.componentType === 'FEATURE').length;
        
        document.getElementById('designDocCount').textContent = designDocCount;
        document.getElementById('connectionCount').textContent = connectionCount;
        document.getElementById('featureCount').textContent = featureCount;
    }
    
    updateLegend() {
        // Update document type legend
        const docTypeLegend = document.getElementById('docTypeLegend');
        if (docTypeLegend) {
            docTypeLegend.innerHTML = '';
            Object.entries(this.docTypeColors).forEach(([type, color]) => {
                const item = document.createElement('div');
                item.className = 'legend-item';
                item.innerHTML = `
                    <div class="legend-color" style="background-color: ${color}"></div>
                    <span>${type.replace('_', ' ')}</span>
                `;
                docTypeLegend.appendChild(item);
            });
        }
        
        // Update connection type legend
        const connectionLegend = document.getElementById('connectionLegend');
        if (connectionLegend) {
            connectionLegend.innerHTML = '';
            Object.entries(this.connectionColors).forEach(([type, color]) => {
                const item = document.createElement('div');
                item.className = 'legend-item';
                item.innerHTML = `
                    <div class="legend-line" style="background-color: ${color}"></div>
                    <span>${type.replace('_', ' ')}</span>
                `;
                connectionLegend.appendChild(item);
            });
        }
    }
    
    applyTimeOrderFilter() {
        // Apply time-based filtering and sorting
        if (this.filters.timeOrderFilter === 'chronological') {
            // Sort connections by time order and filter nodes accordingly
            this.filteredData.links = this.data.links
                .filter(link => link.timeOrder !== undefined)
                .sort((a, b) => (a.timeOrder || 0) - (b.timeOrder || 0));
        } else if (this.filters.timeOrderFilter === 'reverse') {
            this.filteredData.links = this.data.links
                .filter(link => link.timeOrder !== undefined)
                .sort((a, b) => (b.timeOrder || 0) - (a.timeOrder || 0));
        } else {
            // Show all links
            this.filteredData.links = [...this.data.links];
        }
    }
    
    updateLayout() {
        // Calculate columns based on grid size (how many nodes fit per row)
        const totalSpacePerNode = this.config.nodeWidth + this.config.nodeGap;
        const columnsFromGridSize = Math.max(1, Math.floor(this.config.gridSize / totalSpacePerNode));
        const columns = Math.max(1, columnsFromGridSize);
        
        // Re-position nodes based on grid with proper padding and spacing
        this.filteredData.nodes.forEach((node, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            node.position = {
                x: this.config.canvasPadding + col * (this.config.nodeWidth + this.config.nodeGap),
                y: this.config.canvasPadding + row * (this.config.nodeHeight + this.config.nodeGap)
            };
        });
        
        this.renderVisualization();
    }
    
    centerView() {
        this.designCanvas.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
    
    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'design-docs.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    showLoading(show) {
        let loadingOverlay = document.getElementById('loadingOverlay');
        if (show) {
            if (!loadingOverlay) {
                loadingOverlay = document.createElement('div');
                loadingOverlay.id = 'loadingOverlay';
                loadingOverlay.className = 'loading-overlay';
                loadingOverlay.textContent = 'Loading design documents...';
                this.designCanvas.appendChild(loadingOverlay);
            }
        } else if (loadingOverlay) {
            loadingOverlay.remove();
        }
    }
    
    createMockNodes() {
        return [
            {
                id: '1',
                name: 'User Authentication System',
                description: '## Overview\n\nThis specification defines the user authentication system for our application.\n\n### Requirements\n\n- Support email/password login\n- Implement OAuth2 integration\n- Provide secure session management\n\n### Security Considerations\n\n- Passwords must be hashed using bcrypt\n- Sessions expire after 24 hours\n- Failed login attempts are rate-limited',
                componentType: 'SPECIFICATION',
                codebase: 'webapp',
                position: { x: 50, y: 50 }
            },
            {
                id: '2',
                name: 'Login Feature',
                description: '**As a user**, I want to log into my account so that I can access personalized features.\n\n### Acceptance Criteria\n\n- [ ] User can enter email and password\n- [ ] System validates credentials\n- [ ] User is redirected to dashboard on success\n- [ ] Error message shown on failure',
                componentType: 'USER_STORY',
                codebase: 'webapp',
                position: { x: 400, y: 50 }
            },
            {
                id: '3',
                name: 'OAuth Integration',
                description: 'Implement OAuth2 authentication for third-party providers:\n\n- Google\n- GitHub\n- Microsoft\n\nThis feature allows users to sign in using their existing accounts from these providers, reducing friction in the registration process.',
                componentType: 'FEATURE',
                codebase: 'webapp',
                position: { x: 750, y: 50 }
            },
            {
                id: '4',
                name: 'Password Security Requirements',
                description: 'All user passwords must meet the following criteria:\n\n1. Minimum 8 characters\n2. At least one uppercase letter\n3. At least one lowercase letter\n4. At least one number\n5. At least one special character\n\nPasswords must be hashed using bcrypt with a minimum cost factor of 12.',
                componentType: 'REQUIREMENT',
                codebase: 'webapp',
                position: { x: 50, y: 300 }
            },
            {
                id: '5',
                name: 'Login Success Criteria',
                description: 'The login functionality is considered successful when:\n\n✅ User can authenticate with valid credentials\n✅ Invalid credentials show appropriate error\n✅ Account lockout after 5 failed attempts\n✅ Session persists across browser tabs\n✅ Logout clears all session data',
                componentType: 'ACCEPTANCE_CRITERIA',
                codebase: 'webapp',
                position: { x: 400, y: 300 }
            }
        ];
    }
    
    createMockLinks() {
        return [
            { source: '2', target: '1', type: 'IMPLEMENTS' },
            { source: '3', target: '1', type: 'EXTENDS' },
            { source: '4', target: '1', type: 'REFINES' },
            { source: '5', target: '2', type: 'VALIDATES' },
            { source: '2', target: '4', type: 'DEPENDS_ON' }
        ];
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DesignDocsVisualization();
});
