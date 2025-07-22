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
            gridSize: 200
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
            'VERIFIES': '#E91E63'
        };
        
        this.initializeVisualization();
        this.setupEventListeners();
        this.loadData();
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
    }
    
    async loadData() {
        try {
            // Show loading
            this.showLoading(true);
            
            // For now, use mock data - replace with API call
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.data.nodes = this.createMockNodes();
            this.data.links = this.createMockLinks();
            
            this.filteredData = JSON.parse(JSON.stringify(this.data));
            
            this.renderVisualization();
            this.updateStatistics();
            this.updateLegend();
            
        } catch (error) {
            console.error('Error loading design docs:', error);
        } finally {
            this.showLoading(false);
        }
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
        nodeDiv.className = `doc-node doc-type-${node.componentType?.toLowerCase() || 'unknown'}`;
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
        
        // Calculate connection points
        const sourceX = sourceNode.position.x + this.config.nodeWidth / 2;
        const sourceY = sourceNode.position.y + this.config.nodeHeight / 2;
        const targetX = targetNode.position.x + this.config.nodeWidth / 2;
        const targetY = targetNode.position.y + this.config.nodeHeight / 2;
        
        // Create orthogonal path (90-degree turns)
        const path = this.createOrthogonalPath(sourceX, sourceY, targetX, targetY);
        
        const connection = this.svg.append('path')
            .attr('d', path)
            .attr('class', `connection-line connection-${link.type.toLowerCase()}`)
            .attr('marker-end', 'url(#arrowhead)')
            .style('stroke', this.connectionColors[link.type] || '#999')
            .style('stroke-width', '2px')
            .style('fill', 'none');
        
        // Add label
        const midX = (sourceX + targetX) / 2;
        const midY = (sourceY + targetY) / 2;
        
        this.svg.append('text')
            .attr('x', midX)
            .attr('y', midY - 5)
            .attr('class', 'connection-label')
            .style('font-size', '10px')
            .style('fill', '#666')
            .style('text-anchor', 'middle')
            .text(link.type.replace('_', ' '));
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
    
    updateLayout() {
        // Re-position nodes based on grid
        this.filteredData.nodes.forEach((node, index) => {
            const col = index % 3;
            const row = Math.floor(index / 3);
            node.position = {
                x: 50 + col * (this.config.nodeWidth + 50),
                y: 50 + row * (this.config.nodeHeight + 50)
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
