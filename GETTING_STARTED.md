# Getting Started with Codebase Graph Visualizer

Welcome to your new visualization project! This tool creates interactive web-based visualizations of the codebase graphs stored in Neo4j by the codebase-graph-mcp server.

## 🚀 Quick Start

### 1. Prerequisites Check
Make sure you have:
- ✅ Neo4j database running on `bolt://localhost:7687`
- ✅ Node.js 18+ installed
- ✅ The codebase-graph-mcp project available (optional, for populating data)

### 2. Install Dependencies
```bash
npm install
```

### 3. Populate Sample Data (Optional)
To test the visualizer with sample data:
```bash
npm run demo
```

This creates:
- 16 sample components (files, classes, functions, modules, etc.)
- 17 relationships between components
- 6 sample tasks linked to components
- 2 sample codebases: "demo-app" and "graph-visualizer"

### 4. Start the Server
```bash
npm start
```

### 5. Open in Browser
Navigate to `http://localhost:3000`

## 🎯 What You'll See

### Interactive Graph Visualization
- **Nodes**: Different shapes and colors for components and tasks
- **Links**: Colored arrows showing relationships between components
- **Labels**: Component and task names displayed below nodes

### Control Panel Features
- **Codebase Selector**: Filter by specific codebase or view all
- **Filters**: Show/hide component types, relationship types, and task statuses
- **Layout Controls**: Adjust physics simulation parameters
- **Statistics**: Real-time counts of components, tasks, and relationships

### Interactive Features
- **Zoom & Pan**: Mouse wheel to zoom, drag to pan
- **Node Selection**: Click nodes to see detailed information
- **Drag Nodes**: Reposition nodes by dragging
- **Hover Tooltips**: Quick information on hover

## 🎨 Understanding the Visualization

### Color Coding

**Component Types:**
- 🟢 FILE: Green
- 🔵 FUNCTION: Blue  
- 🟠 CLASS: Orange
- 🟣 MODULE: Purple
- 🔴 SYSTEM: Red
- 🔷 INTERFACE: Cyan
- 🟡 VARIABLE: Light Green
- 🟤 CONSTANT: Brown

**Task Status:**
- ⚪ TODO: Gray
- 🔵 IN_PROGRESS: Blue
- 🟢 DONE: Green
- 🔴 BLOCKED: Red
- ⚫ CANCELLED: Dark Gray

**Relationships:**
- 🔴 DEPENDS_ON: Red arrows
- 🟢 IMPLEMENTS: Green arrows
- 🟠 EXTENDS: Orange arrows
- 🔵 CONTAINS: Blue arrows
- 🟣 CALLS: Purple arrows
- And more...

## 🔧 Using with Real Data

### Option 1: Use codebase-graph-mcp
1. Set up the codebase-graph-mcp server
2. Use it with an AI agent to analyze your codebase
3. The visualizer will automatically show your real graph data

### Option 2: Direct Neo4j Data
The visualizer works with any Neo4j database that has:
- `Component` nodes with properties: `id`, `type`, `name`, `codebase`, `description`, `path`
- `Task` nodes with properties: `id`, `name`, `status`, `progress`, `description`
- Relationships between components
- `RELATES_TO` relationships between tasks and components

## 📊 API Endpoints

The server exposes REST endpoints you can use programmatically:

- `GET /api/health` - Check server status
- `GET /api/graph` - Full graph data
- `GET /api/graph/:codebase` - Codebase-specific data
- `GET /api/components` - All components
- `GET /api/tasks` - All tasks
- `GET /api/overview/:codebase` - Statistics

## ⚙️ Configuration

### Database Connection
Set environment variables:
```bash
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USERNAME=neo4j
export NEO4J_PASSWORD=your_password
export PORT=3000
```

### Customization
- **Colors**: Edit `visualization.js` color schemes
- **Layout**: Adjust D3.js force simulation parameters
- **UI**: Modify `styles.css` for visual changes
- **Data**: Add new API endpoints in `server.js`

## 🛠️ Development Workflow

### With codebase-graph-mcp:
1. Use MCP server + AI agent to analyze code
2. Refresh visualizer to see updates
3. Use filters to focus on specific areas
4. Export data for further analysis

### Standalone:
1. Run demo script to populate sample data
2. Experiment with visualization features
3. Modify and extend as needed
4. Use for architecture documentation

## 🎯 Use Cases

### Code Architecture Analysis
- Visualize component dependencies
- Identify tightly coupled modules
- Find architectural patterns
- Document system structure

### Project Management
- Track task progress visually
- See task-component relationships
- Monitor development status
- Plan refactoring efforts

### Code Reviews
- Understand change impact
- Visualize affected components
- Review dependency changes
- Assess architectural consistency

## 🚨 Troubleshooting

### Common Issues

1. **Blank Graph**
   - Run `npm run demo` to add sample data
   - Check Neo4j connection
   - Verify data exists in database

2. **Connection Errors**
   - Ensure Neo4j is running
   - Check connection credentials
   - Verify firewall settings

3. **Performance Issues**
   - Use filters to reduce visible nodes
   - Adjust simulation parameters
   - Check browser developer console

### Getting Help
- Check the browser console for JavaScript errors
- Use the network tab to debug API requests
- Verify Neo4j queries work directly

## 🎉 Next Steps

1. **Explore Sample Data**: Use filters and controls to understand features
2. **Connect Real Data**: Set up codebase-graph-mcp or populate your own data
3. **Customize**: Modify colors, layout, and UI to match your needs
4. **Extend**: Add new visualization features or analysis tools
5. **Share**: Use the export feature to save and share graph data

## 💡 Tips

- Use the codebase selector to focus on specific projects
- Combine multiple filters for targeted analysis
- Adjust layout controls for better node positioning  
- Click and drag nodes to organize the view manually
- Use the center button to reset the view after zooming/panning

Happy visualizing! 🚀
