class ArchitecturalDiagramVisualization {
    constructor() {
        this.architecturalCanvas = document.getElementById('architecturalCanvas');
        this.svg = null;
        this.data = { nodes: [], links: [] };
        this.allData = { nodes: [], links: [] }; // Store original data for filtering
        this.selectedCodebase = '';

        // Configuration
        this.config = {
            layerSpacing: 200,
            nodeSpacing: 100,
            showGrid: true,
            layoutType: 'hierarchical'
        };

        // Color scheme for different component types
        this.colorScheme = {
            'SYSTEM': '#FF6B6B',
            'SERVICE': '#4ECDC4', 
            'DATABASE': '#45B7D1',
            'API': '#96CEB4',
            'COMPONENT': '#FFEAA7',
            'MODULE': '#DDA0DD',
            'LIBRARY': '#98D8C8',
            'default': '#95A5A6'
        };

        // Initialize the diagram
        this.initializeVisualization();
        this.setupEventListeners();
        this.loadData();
    }

    initializeVisualization() {
        // Create SVG for architecture layout
        this.svg = d3.select(this.architecturalCanvas)
            .append('svg')
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('width', '100%')
            .style('height', '100%')
            .style('cursor', 'grab')
            .style('background-color', '#2c3e50'); // Dark background color

        // Add arrow marker definition
        const defs = this.svg.append('defs');
        defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 8)
            .attr('markerHeight', 8)
            .attr('xoverflow', 'visible')
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
            .attr('fill', '#999')
            .style('stroke', 'none');

        // Add zoom and pan behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 5])
            .on('zoom', (event) => {
                this.zoomContainer.attr('transform', event.transform);
                this.svg.style('cursor', event.sourceEvent && event.sourceEvent.type === 'mousemove' ? 'grabbing' : 'grab');
            })
            .on('end', () => {
                this.svg.style('cursor', 'grab');
            });

        this.svg.call(this.zoom);

        // Create a container group for all zoomable content
        this.zoomContainer = this.svg.append('g')
            .attr('class', 'zoom-container');

        // Add grid lines if necessary
        if (this.config.showGrid) {
            this.drawGrid();
        }
    }

    drawGrid() {
        // Drawing grid code here
    }

    setupEventListeners() {
        // Layout controls with multiple event types for real-time updates
        const layerSpacingSlider = document.getElementById('layerSpacing');
        const nodeSpacingSlider = document.getElementById('nodeSpacing');
        
        // Layer spacing slider
        const updateLayerSpacing = (e) => {
            this.config.layerSpacing = parseInt(e.target.value);
            // Clear existing positions to force re-layout
            this.data.nodes.forEach(node => {
                delete node.position;
            });
            this.updateLayout();
        };
        
        layerSpacingSlider.addEventListener('input', updateLayerSpacing);
        layerSpacingSlider.addEventListener('change', updateLayerSpacing);
        layerSpacingSlider.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) { // Left mouse button is pressed
                updateLayerSpacing(e);
            }
        });
        
        // Node spacing slider
        const updateNodeSpacing = (e) => {
            this.config.nodeSpacing = parseInt(e.target.value);
            // Clear existing positions to force re-layout
            this.data.nodes.forEach(node => {
                delete node.position;
            });
            this.updateLayout();
        };
        
        nodeSpacingSlider.addEventListener('input', updateNodeSpacing);
        nodeSpacingSlider.addEventListener('change', updateNodeSpacing);
        nodeSpacingSlider.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) { // Left mouse button is pressed
                updateNodeSpacing(e);
            }
        });

        document.getElementById('showGrid').addEventListener('change', (e) => {
            this.config.showGrid = e.target.checked;
            this.renderVisualization();
        });

        document.getElementById('layoutType').addEventListener('change', (e) => {
            this.config.layoutType = e.target.value;
            // Clear existing positions to force re-layout
            this.data.nodes.forEach(node => {
                delete node.position;
            });
            this.updateLayout();
        });

        // Codebase selector
        document.getElementById('codebaseSelect').addEventListener('change', (e) => {
            this.selectedCodebase = e.target.value;
            this.filterData();
        });

        // Other controls
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadData();
        });

        document.getElementById('centerBtn').addEventListener('click', () => {
            this.centerView();
        });
    }

    async loadData() {
        try {
            console.log('Loading data from /api/graph...');
            const response = await fetch('/api/graph');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Data loaded:', data);
            
            // Store original data for filtering
            this.allData.nodes = data.nodes || [];
            this.allData.links = data.links || [];
            
            // Set current data to all data initially
            this.data.nodes = [...this.allData.nodes];
            this.data.links = [...this.allData.links];
            
            // Populate codebase selector
            this.populateCodebaseSelector();
            
            this.updateStatistics(data.statistics);
            this.renderVisualization();
        } catch (error) {
            console.error('Error loading data:', error);
            // Show error in the UI
            this.showError(`Failed to load data: ${error.message}`);
        }
    }

    renderVisualization() {
        // Clear existing content from zoom container
        this.zoomContainer.selectAll('*').remove();
        
        // Recreate zoom container if it was removed
        if (this.zoomContainer.empty()) {
            this.zoomContainer = this.svg.append('g')
                .attr('class', 'zoom-container');
        }
        
        // Add grid lines if necessary
        if (this.config.showGrid) {
            this.drawGrid();
        }
        
        // Auto-position nodes that don't have positions
        this.positionNodes();
        
        console.log(`Rendering ${this.data.nodes.length} nodes and ${this.data.links.length} links`);

        this.data.nodes.forEach(node => this.createNodeElement(node));
        this.data.links.forEach(link => this.createConnectionElement(link));
    }

    createNodeElement(node) {
        // Skip nodes without valid positions
        if (!node.position || node.position.x === undefined || node.position.y === undefined) {
            console.warn('Skipping node with invalid position:', node.name);
            return;
        }
        
        const nodeElement = this.zoomContainer.append('g')
            .attr('class', 'node')
            .attr('transform', `translate(${node.position.x}, ${node.position.y})`)
            .style('cursor', 'grab')
            .style('pointer-events', 'all');

        // Get color based on component type
        const nodeColor = this.colorScheme[node.componentType] || this.colorScheme.default;

        // Add drag behavior
        const drag = d3.drag()
            .on('start', (event) => {
                nodeElement.style('cursor', 'grabbing');
            })
            .on('drag', (event) => {
                node.position.x = event.x;
                node.position.y = event.y;
                nodeElement.attr('transform', `translate(${event.x}, ${event.y})`);
                
                // Update connected lines
                this.updateConnectionsForNode(node);
            })
            .on('end', (event) => {
                nodeElement.style('cursor', 'grab');
            });

        nodeElement.call(drag);

        // Add circle with color coding
        nodeElement.append('circle')
            .attr('r', 25)
            .attr('fill', nodeColor)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('opacity', 0.8);

        // Add component type as smaller text
        nodeElement.append('text')
            .attr('dy', 5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('font-weight', '600')
            .attr('fill', '#ffffff')
            .attr('stroke', '#000000')
            .attr('stroke-width', '0.5px')
            .attr('paint-order', 'stroke fill')
            .text(node.componentType || 'COMPONENT');

        // Add node name below
        nodeElement.append('text')
            .attr('dy', 35)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .attr('fill', '#ffffff')
            .attr('stroke', '#000000')
            .attr('stroke-width', '0.8px')
            .attr('paint-order', 'stroke fill')
            .text(node.name || 'Unnamed');

        // Add hover effects
        nodeElement
            .on('mouseover', () => {
                nodeElement.select('circle').attr('opacity', 1);
            })
            .on('mouseout', () => {
                nodeElement.select('circle').attr('opacity', 0.8);
            })
            .on('click', () => {
                this.selectNode(node);
            });
    }

    createConnectionElement(link) {
        const sourceNode = this.data.nodes.find(n => n.id === link.source);
        const targetNode = this.data.nodes.find(n => n.id === link.target);
        
        // Skip connections where nodes don't exist or don't have valid positions
        if (!sourceNode || !targetNode || 
            !sourceNode.position || !targetNode.position ||
            sourceNode.position.x === undefined || sourceNode.position.y === undefined ||
            targetNode.position.x === undefined || targetNode.position.y === undefined) {
            console.warn('Skipping connection due to missing nodes or positions:', link);
            return;
        }
        
        // Determine connection style based on relationship type
        const connectionStyle = this.getConnectionStyle(link.relationshipType || link.type);
        
        // Create curved path for better visual organization
        const path = this.createCurvedPath(sourceNode.position, targetNode.position);
        
        const connection = this.zoomContainer.append('path')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', connectionStyle.color)
            .attr('stroke-width', connectionStyle.width)
            .attr('stroke-opacity', connectionStyle.opacity)
            .attr('stroke-dasharray', connectionStyle.dashArray)
            .attr('marker-end', connectionStyle.markerEnd)
            .attr('data-source', link.source)
            .attr('data-target', link.target)
            .attr('data-relationship-type', link.relationshipType || link.type || 'default')
            .style('cursor', 'pointer');
        
        // Add hover effects
        connection
            .on('mouseover', function() {
                d3.select(this)
                    .attr('stroke-opacity', Math.min(connectionStyle.opacity + 0.3, 1))
                    .attr('stroke-width', connectionStyle.width + 1);
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('stroke-opacity', connectionStyle.opacity)
                    .attr('stroke-width', connectionStyle.width);
            })
            .on('click', () => {
                this.selectConnection(link, sourceNode, targetNode);
            });
    }

    positionNodes() {
        switch (this.config.layoutType) {
            case 'hierarchical':
                this.positionNodesHierarchical();
                break;
            case 'layered':
                this.positionNodesLayered();
                break;
            case 'modular':
                this.positionNodesModular();
                break;
            case 'circular':
                this.positionNodesCircular();
                break;
            default:
                this.positionNodesGrid();
        }
    }

    positionNodesGrid() {
        const cols = Math.max(1, Math.floor(this.architecturalCanvas.clientWidth / (this.config.nodeSpacing + 100)));
        const nodeRadius = 25;
        
        this.data.nodes.forEach((node, index) => {
            if (!node.position) {
                const col = index % cols;
                const row = Math.floor(index / cols);
                node.position = {
                    x: col * this.config.nodeSpacing + nodeRadius + 50,
                    y: row * this.config.layerSpacing + nodeRadius + 50
                };
            }
        });
    }

    positionNodesHierarchical() {
        // Group nodes by codebase first, then arrange hierarchically
        const codebaseGroups = new Map();
        this.data.nodes.forEach(node => {
            const codebase = node.codebase || 'unknown';
            if (!codebaseGroups.has(codebase)) {
                codebaseGroups.set(codebase, []);
            }
            codebaseGroups.get(codebase).push(node);
        });

        let currentY = 50;
        codebaseGroups.forEach((nodes, codebase) => {
            const cols = Math.ceil(Math.sqrt(nodes.length));
            nodes.forEach((node, index) => {
                if (!node.position) {
                    const col = index % cols;
                    const row = Math.floor(index / cols);
                    node.position = {
                        x: col * this.config.nodeSpacing + 50,
                        y: currentY + row * 80
                    };
                }
            });
            currentY += this.config.layerSpacing;
        });
    }

    positionNodesLayered() {
        // Arrange nodes in horizontal layers based on component type
        const layerOrder = ['DATABASE', 'API', 'SERVICE', 'COMPONENT', 'SYSTEM', 'MODULE', 'LIBRARY'];
        const layers = new Map();
        
        this.data.nodes.forEach(node => {
            const type = node.componentType || 'COMPONENT';
            if (!layers.has(type)) {
                layers.set(type, []);
            }
            layers.get(type).push(node);
        });

        let currentY = 50;
        layerOrder.forEach(layerType => {
            if (layers.has(layerType)) {
                const nodes = layers.get(layerType);
                nodes.forEach((node, index) => {
                    if (!node.position) {
                        node.position = {
                            x: index * this.config.nodeSpacing + 50,
                            y: currentY
                        };
                    }
                });
                currentY += this.config.layerSpacing;
            }
        });
    }

    positionNodesModular() {
        // Arrange nodes in modules/blocks
        this.positionNodesGrid(); // Use grid as fallback
    }

    positionNodesCircular() {
        // Arrange nodes in circular pattern
        const centerX = this.architecturalCanvas.clientWidth / 2;
        const centerY = this.architecturalCanvas.clientHeight / 2;
        const radius = Math.min(centerX, centerY) - 100;
        
        this.data.nodes.forEach((node, index) => {
            if (!node.position) {
                const angle = (2 * Math.PI * index) / this.data.nodes.length;
                node.position = {
                    x: centerX + radius * Math.cos(angle),
                    y: centerY + radius * Math.sin(angle)
                };
            }
        });
    }

    updateLayout() {
        this.renderVisualization();
    }
    
    updateStatistics(stats) {
        if (!stats) return;
        
        document.getElementById('componentCount').textContent = stats.componentCount || 0;
        document.getElementById('systemCount').textContent = this.data.nodes.filter(n => n.componentType === 'SYSTEM').length;
        document.getElementById('layerCount').textContent = new Set(this.data.nodes.map(n => n.codebase).filter(Boolean)).size;
        document.getElementById('connectionCount').textContent = stats.relationshipCount || 0;
    }
    
    showError(message) {
        // Clear existing content
        this.architecturalCanvas.innerHTML = '';
        
        // Create error message
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #666;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        `;
        errorDiv.innerHTML = `
            <h3>⚠️ Unable to Load Data</h3>
            <p>${message}</p>
            <p><small>Check the console for more details.</small></p>
            <button onclick="location.reload()" style="
                margin-top: 1rem;
                padding: 0.5rem 1rem;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            ">Retry</button>
        `;
        this.architecturalCanvas.appendChild(errorDiv);
    }

    getConnectionStyle(relationshipType) {
        // Define styles for different relationship types
        const styles = {
            'DEPENDS_ON': {
                color: '#667eea',
                width: 2,
                opacity: 0.7,
                dashArray: 'none',
                markerEnd: 'url(#arrowhead)'
            },
            'USES': {
                color: '#764ba2',
                width: 1.5,
                opacity: 0.6,
                dashArray: '5,5',
                markerEnd: 'url(#arrowhead)'
            },
            'IMPLEMENTS': {
                color: '#f093fb',
                width: 2.5,
                opacity: 0.8,
                dashArray: 'none',
                markerEnd: 'url(#arrowhead)'
            },
            'CONTAINS': {
                color: '#4facfe',
                width: 3,
                opacity: 0.6,
                dashArray: 'none',
                markerEnd: 'url(#arrowhead)'
            },
            'default': {
                color: '#95a5a6',
                width: 1.5,
                opacity: 0.5,
                dashArray: 'none',
                markerEnd: 'url(#arrowhead)'
            }
        };
        
        return styles[relationshipType] || styles.default;
    }

    createCurvedPath(source, target) {
        // Create a curved path between two points for better visual organization
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        
        // Use a subtle curve - adjust the curve strength based on distance
        const curveStrength = Math.min(dr * 0.3, 100);
        
        // Calculate control point for the curve
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        
        // Offset the control point perpendicular to the line
        const perpX = -dy / dr * curveStrength;
        const perpY = dx / dr * curveStrength;
        const controlX = midX + perpX;
        const controlY = midY + perpY;
        
        return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
    }

    selectConnection(link, sourceNode, targetNode) {
        // Update selection info panel for connection
        const selectionInfo = document.getElementById('selectionInfo');
        selectionInfo.innerHTML = `
            <h4>Connection</h4>
            <p><strong>From:</strong> ${sourceNode.name || 'Unnamed'}</p>
            <p><strong>To:</strong> ${targetNode.name || 'Unnamed'}</p>
            <p><strong>Type:</strong> ${link.relationshipType || link.type || 'Unknown'}</p>
            ${link.description ? `<p><strong>Description:</strong> ${link.description}</p>` : ''}
        `;
    }

    updateConnectionsForNode(node) {
        // Update all connections for a moved node
        const self = this; // Store reference to 'this' for use inside the function
        this.zoomContainer.selectAll('path').each(function(d, i) {
            const path = d3.select(this);
            const sourceId = path.attr('data-source');
            const targetId = path.attr('data-target');
            
            if (sourceId === node.id || targetId === node.id) {
                // Find the source and target nodes
                const sourceNode = sourceId === node.id ? node : 
                    self.data.nodes.find(n => n.id === sourceId);
                const targetNode = targetId === node.id ? node : 
                    self.data.nodes.find(n => n.id === targetId);
                
                if (sourceNode && targetNode && sourceNode.position && targetNode.position) {
                    const newPath = self.createCurvedPath(sourceNode.position, targetNode.position);
                    path.attr('d', newPath);
                }
            }
        });
    }

    async selectNode(node) {
        // Update selection info panel using the same comprehensive template as main graph view
        const info = document.getElementById('selectionInfo');
        
        if (!node) {
            info.innerHTML = '<p>Click on a node to see details</p>';
            return;
        }
        
        let relationshipsHtml = '';
        if (node.type === 'component' || node.componentType) {
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
                            relationshipsHtml += `<h6 style="color: ${this.getRelationshipColor(relType)}"><strong>${relType}</strong> (${rels.length})</h6>`;
                            
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
            <h4>${node.name || 'Unnamed'}</h4>
            <div class="info-item">
                <span class="info-label">Type:</span>
                <span>${node.type || 'component'}</span>
            </div>
            ${(node.type === 'component' || node.componentType) ? `
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
                    <span>${Math.round((node.progress || 0) * 100)}%</span>
                </div>
            ` : ''}
            <div class="info-item">
                <span class="info-label">Position:</span>
                <span>(${Math.round(node.position.x)}, ${Math.round(node.position.y)})</span>
            </div>
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

    filterData() {
        if (!this.selectedCodebase) {
            this.data = { ...this.allData };
        } else {
            this.data.nodes = this.allData.nodes.filter(node => 
                node.codebase === this.selectedCodebase
            );
            this.data.links = this.allData.links.filter(link => {
                const sourceExists = this.data.nodes.some(n => n.id === link.source);
                const targetExists = this.data.nodes.some(n => n.id === link.target);
                return sourceExists && targetExists;
            });
        }
        this.renderVisualization();
    }

    populateCodebaseSelector() {
        const codebaseSelect = document.getElementById('codebaseSelect');
        const codebases = new Set(this.allData.nodes
            .map(node => node.codebase)
            .filter(Boolean));
        
        // Clear existing options except "All Codebases"
        codebaseSelect.innerHTML = '<option value="">All Codebases</option>';
        
        // Add codebase options
        codebases.forEach(codebase => {
            const option = document.createElement('option');
            option.value = codebase;
            option.textContent = codebase;
            codebaseSelect.appendChild(option);
        });
    }

    // Helper methods from main graph view for comprehensive node details
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
            'index', 'vx', 'vy', 'position'
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

    getRelationshipColor(relType) {
        // Use connection style colors for relationships
        const connectionStyle = this.getConnectionStyle(relType);
        return connectionStyle.color;
    }

    selectAndFocusNodeById(nodeId) {
        if (!this.data.nodes || this.data.nodes.length === 0) {
            console.warn('No nodes available to select from');
            return;
        }
        
        // Find the node in current data
        const nodeToSelect = this.data.nodes.find(node => node.id === nodeId);
        
        if (!nodeToSelect) {
            // Check if it exists in all data but is filtered out
            const hiddenNode = this.allData.nodes.find(node => node.id === nodeId);
            if (hiddenNode) {
                console.warn(`Node "${hiddenNode.name}" is currently hidden by filters`);
                // You could show a notification here
            } else {
                console.warn(`Node with ID ${nodeId} not found`);
            }
            return;
        }
        
        // Select the node
        this.selectNode(nodeToSelect);
        
        // Center the view on this node with animation
        if (nodeToSelect.position && nodeToSelect.position.x && nodeToSelect.position.y) {
            const svgWidth = this.architecturalCanvas.clientWidth;
            const svgHeight = this.architecturalCanvas.clientHeight;
            const svgCenterX = svgWidth / 2;
            const svgCenterY = svgHeight / 2;
            
            const transform = d3.zoomIdentity
                .translate(svgCenterX - nodeToSelect.position.x, svgCenterY - nodeToSelect.position.y)
                .scale(1.2);
            
            this.svg.transition().duration(750).call(
                this.zoom.transform,
                transform
            );
        }
    }

    centerView() {
        if (this.data.nodes.length === 0) return;
        
        // Calculate bounds of all nodes
        const positions = this.data.nodes
            .filter(node => node.position)
            .map(node => node.position);
        
        if (positions.length === 0) return;
        
        const bounds = {
            minX: Math.min(...positions.map(p => p.x)),
            maxX: Math.max(...positions.map(p => p.x)),
            minY: Math.min(...positions.map(p => p.y)),
            maxY: Math.max(...positions.map(p => p.y))
        };
        
        // Calculate center of all nodes
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        // Calculate SVG center
        const svgWidth = this.architecturalCanvas.clientWidth;
        const svgHeight = this.architecturalCanvas.clientHeight;
        const svgCenterX = svgWidth / 2;
        const svgCenterY = svgHeight / 2;
        
        // Calculate scale to fit all nodes with some padding
        const nodeWidth = bounds.maxX - bounds.minX + 100; // Add padding
        const nodeHeight = bounds.maxY - bounds.minY + 100;
        const scale = Math.min(
            svgWidth / nodeWidth,
            svgHeight / nodeHeight,
            1 // Don't zoom in more than 100%
        );
        
        // Calculate transform to center the nodes
        const transform = d3.zoomIdentity
            .translate(svgCenterX - centerX * scale, svgCenterY - centerY * scale)
            .scale(scale);
        
        // Apply the transform with smooth animation
        this.svg.transition()
            .duration(750)
            .call(this.zoom.transform, transform);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new ArchitecturalDiagramVisualization();
});

