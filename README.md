# Codebase Graph Visualizer

A web-based visualization tool for exploring codebase graphs stored in Neo4j, designed to work with the [codebase-graph-mcp](../codebase-graph-mcp) project.

## Features

🎨 **Interactive D3.js Visualization**
- Force-directed graph layout with customizable physics
- Drag nodes, zoom, and pan
- Color-coded components and relationships
- Real-time filtering and search

📊 **Rich Data Display**
- Components (files, functions, classes, modules, systems, interfaces)
- Tasks with progress tracking
- Relationships (dependencies, inheritance, calls, imports, etc.)
- Real-time statistics and metrics

🔧 **Advanced Controls**
- Filter by component types, relationship types, and task status
- Adjust graph physics (force strength, link distance, charge)
- Export graph data as JSON
- Multi-codebase support

📱 **Modern Interface**
- Responsive design
- Intuitive sidebar with panels for statistics, filters, and selection info
- Tooltips and detailed information display
- Professional styling with smooth animations

## Prerequisites

- Node.js 18+
- Neo4j database running (same as codebase-graph-mcp)
- codebase-graph-mcp server running and populated with data

## Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Configure database connection** (optional):
Edit connection settings in `server.js` or use environment variables:
```bash
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USERNAME=neo4j
export NEO4J_PASSWORD=your_password
export PORT=3000
```

3. **Start the server**:
```bash
npm start
```

4. **Open in browser**:
Navigate to `http://localhost:3000`

## Usage

### Basic Navigation
- **Zoom**: Mouse wheel or trackpad scroll
- **Pan**: Click and drag empty space
- **Drag Nodes**: Click and drag any node to reposition
- **Select Node**: Click on any node to see details in the sidebar
- **Hover**: Hover over nodes for quick tooltips

### Filters
Use the sidebar filters to show/hide:
- **Component Types**: FILE, FUNCTION, CLASS, MODULE, SYSTEM, INTERFACE, VARIABLE, CONSTANT
- **Relationship Types**: DEPENDS_ON, IMPLEMENTS, EXTENDS, CONTAINS, CALLS, IMPORTS, etc.
- **Task Status**: TODO, IN_PROGRESS, DONE, BLOCKED, CANCELLED

### Controls
- **Codebase Selector**: View specific codebases or all data
- **Refresh**: Reload data from the database
- **Center**: Reset zoom and pan to center view
- **Export**: Download current graph data as JSON

### Layout Adjustment
Fine-tune the graph physics:
- **Force Strength**: Overall simulation strength (0-200)
- **Link Distance**: Preferred distance between connected nodes (30-300px)
- **Charge**: Node repulsion strength (-500 to 0)

## Color Coding

### Component Types
- 🟢 **FILE**: Green (#4CAF50)
- 🔵 **FUNCTION**: Blue (#2196F3)
- 🟠 **CLASS**: Orange (#FF9800)
- 🟣 **MODULE**: Purple (#9C27B0)
- 🔴 **SYSTEM**: Red (#F44336)
- 🔷 **INTERFACE**: Cyan (#00BCD4)
- 🟡 **VARIABLE**: Light Green (#8BC34A)
- 🟤 **CONSTANT**: Brown (#795548)

### Task Status
- ⚪ **TODO**: Gray (#9E9E9E)
- 🔵 **IN_PROGRESS**: Blue (#2196F3)
- 🟢 **DONE**: Green (#4CAF50)
- 🔴 **BLOCKED**: Red (#FF5722)
- ⚫ **CANCELLED**: Dark Gray (#607D8B)

### Relationship Types
- 🔴 **DEPENDS_ON**: Red arrows
- 🟢 **IMPLEMENTS**: Green arrows
- 🟠 **EXTENDS**: Orange arrows
- 🔵 **CONTAINS**: Blue arrows
- 🟣 **CALLS**: Purple arrows
- 🔷 **IMPORTS**: Cyan arrows
- 🟡 **EXPORTS**: Yellow-green arrows
- 🟤 **OVERRIDES**: Brown arrows
- ⚫ **USES**: Gray arrows
- 💗 **CREATES**: Pink arrows

## API Endpoints

The server provides RESTful API endpoints:

- `GET /api/health` - Server health check
- `GET /api/graph` - Full graph data
- `GET /api/graph/:codebase` - Codebase-specific graph
- `GET /api/components` - All components
- `GET /api/components/:id/relationships` - Component relationships
- `GET /api/tasks` - All tasks (optional status filter)
- `GET /api/overview/:codebase` - Codebase statistics
- `GET /api/dependency-tree/:componentId` - Dependency tree

## Architecture

```
codebase-graph-visualizer/
├── server.js              # Express server with Neo4j integration
├── package.json           # Dependencies and scripts
├── public/                # Static web assets
│   ├── index.html        # Main HTML page
│   ├── styles.css        # CSS styles and responsive design
│   └── visualization.js  # D3.js visualization logic
└── README.md             # This documentation
```

### Technology Stack
- **Backend**: Node.js + Express + Neo4j Driver
- **Frontend**: D3.js + Vanilla JavaScript + Modern CSS
- **Database**: Neo4j (shared with codebase-graph-mcp)

## Integration with codebase-graph-mcp

This visualizer works seamlessly with the codebase-graph-mcp server:

1. Both tools connect to the same Neo4j database
2. Use the MCP server to populate data via AI agents
3. Use this visualizer to explore and analyze the data
4. Real-time updates - refresh to see changes made via MCP

### Example Workflow
1. Use the MCP server with an AI agent to analyze your codebase
2. Create components, relationships, and tasks via the MCP tools
3. Open this visualizer to see the graph representation
4. Filter and explore to understand architecture and dependencies
5. Use insights to plan refactoring or new features

## Development

### Running in Development Mode
```bash
npm run dev
```
Uses `--watch` flag for automatic restart on file changes.

### Customizing Visualization
- **Colors**: Edit color schemes in `visualization.js`
- **Layout**: Adjust force simulation parameters
- **UI**: Modify `styles.css` for visual changes
- **Features**: Add new API endpoints in `server.js`

### Adding New Features
The modular architecture makes it easy to extend:
- Add new filter types in the `GraphVisualizer` class
- Create custom relationship visualizations
- Add new analysis views (timeline, statistics, etc.)
- Implement real-time updates with WebSockets

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Ensure Neo4j is running on `bolt://localhost:7687`
   - Check username/password in environment variables
   - Verify firewall settings

2. **Empty Graph**
   - Ensure codebase-graph-mcp has populated the database
   - Check that components and relationships exist in Neo4j
   - Try refreshing the data

3. **Performance Issues**
   - Reduce the number of visible nodes using filters
   - Adjust force simulation parameters
   - Consider pagination for very large graphs

4. **Layout Problems**
   - Try the "Center" button to reset view
   - Adjust charge and force strength values
   - Clear browser cache and reload

### Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support  
- Safari: Full support
- IE/Legacy browsers: Not supported (requires ES6+)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Related Projects

- **[codebase-graph-mcp](../codebase-graph-mcp)**: MCP server for populating graph data
- **Neo4j**: Graph database for storing codebase information
- **D3.js**: Visualization library for interactive graphs
