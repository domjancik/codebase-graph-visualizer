class ArchitecturalDiagramVisualization {
    constructor() {
        this.architecturalCanvas = document.getElementById('architecturalCanvas');
        this.svg = null;
        this.data = { nodes: [], links: [] };

        // Configuration
        this.config = {
            layerSpacing: 200,
            nodeSpacing: 100,
            showGrid: true
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
            .style('pointer-events', 'none');

        // Add grid lines if necessary
        if (this.config.showGrid) {
            this.drawGrid();
        }
    }

    drawGrid() {
        // Drawing grid code here
    }

    setupEventListeners() {
        // Setup event listeners for layout controls
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
    }

    async loadData() {
        try {
            console.log('Loading data from /api/design-docs...');
            const response = await fetch('/api/design-docs');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Data loaded:', data);
            
            this.data.nodes = data.nodes || [];
            this.data.links = data.links || [];
            
            this.updateStatistics(data.statistics);
            this.renderVisualization();
        } catch (error) {
            console.error('Error loading data:', error);
            // Show error in the UI
            this.showError(`Failed to load data: ${error.message}`);
        }
    }

    renderVisualization() {
        if (this.config.showGrid) {
            this.drawGrid();
        }

        // Clear existing content and render nodes
        this.svg.selectAll('*').remove();

        this.data.nodes.forEach(node => this.createNodeElement(node));
        this.data.links.forEach(link => this.createConnectionElement(link));
    }

    createNodeElement(node) {
        // Code to create node elements
    }

    createConnectionElement(link) {
        // Code to create connection lines between nodes
    }

    updateLayout() {
        this.renderVisualization();
    }
    
    updateStatistics(stats) {
        if (!stats) return;
        
        document.getElementById('componentCount').textContent = stats.designDocCount || 0;
        document.getElementById('systemCount').textContent = (stats.systemCount || 0);
        document.getElementById('layerCount').textContent = (stats.layerCount || 0);
        document.getElementById('connectionCount').textContent = stats.connectionCount || 0;
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
}

window.addEventListener('DOMContentLoaded', () => {
    new ArchitecturalDiagramVisualization();
});

