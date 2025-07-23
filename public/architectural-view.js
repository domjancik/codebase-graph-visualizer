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
            .style('cursor', 'grab');

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
        // Layout controls
        document.getElementById('layerSpacing').addEventListener('input', (e) => {
            this.config.layerSpacing = parseInt(e.target.value);
            this.updateLayout();
        });

        document.getElementById('nodeSpacing').addEventListener('input', (e) => {
            this.config.nodeSpacing = parseInt(e.target.value);
            this.updateLayout();
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
        
        this.zoomContainer.append('line')
            .attr('x1', sourceNode.position.x)
            .attr('y1', sourceNode.position.y)
            .attr('x2', targetNode.position.x)
            .attr('y2', targetNode.position.y)
            .attr('stroke', '#999')
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrowhead)')
            .attr('data-source', link.source)
            .attr('data-target', link.target);
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

    updateConnectionsForNode(node) {
        // Update all connections for a moved node
        this.zoomContainer.selectAll('line').each(function(d, i) {
            const line = d3.select(this);
            const sourceId = line.attr('data-source');
            const targetId = line.attr('data-target');
            
            if (sourceId === node.id) {
                line.attr('x1', node.position.x).attr('y1', node.position.y);
            }
            if (targetId === node.id) {
                line.attr('x2', node.position.x).attr('y2', node.position.y);
            }
        });
    }

    selectNode(node) {
        // Update selection info panel
        const selectionInfo = document.getElementById('selectionInfo');
        selectionInfo.innerHTML = `
            <h4>${node.name || 'Unnamed'}</h4>
            <p><strong>Type:</strong> ${node.componentType || 'Unknown'}</p>
            <p><strong>Codebase:</strong> ${node.codebase || 'Unknown'}</p>
            <p><strong>Position:</strong> (${Math.round(node.position.x)}, ${Math.round(node.position.y)})</p>
            ${node.description ? `<p><strong>Description:</strong> ${node.description}</p>` : ''}
        `;
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

