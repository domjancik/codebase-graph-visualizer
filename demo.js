#!/usr/bin/env node

// Demo script to populate sample data for testing the visualizer
// This creates sample components, relationships, and tasks in the Neo4j database

import neo4j from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

// Sample data
const sampleComponents = [
  // Demo Web App
  { type: 'SYSTEM', name: 'Demo Web App', codebase: 'demo-app', description: 'Main web application system' },
  { type: 'MODULE', name: 'User Module', codebase: 'demo-app', description: 'User management functionality', path: '/src/modules/user' },
  { type: 'MODULE', name: 'Auth Module', codebase: 'demo-app', description: 'Authentication and authorization', path: '/src/modules/auth' },
  { type: 'CLASS', name: 'UserService', codebase: 'demo-app', description: 'Service for user operations', path: '/src/services/UserService.js' },
  { type: 'CLASS', name: 'AuthController', codebase: 'demo-app', description: 'Authentication controller', path: '/src/controllers/AuthController.js' },
  { type: 'FUNCTION', name: 'validateUser', codebase: 'demo-app', description: 'User validation function', path: '/src/utils/validation.js' },
  { type: 'FUNCTION', name: 'hashPassword', codebase: 'demo-app', description: 'Password hashing utility', path: '/src/utils/crypto.js' },
  { type: 'FILE', name: 'database.js', codebase: 'demo-app', description: 'Database connection configuration', path: '/src/config/database.js' },
  { type: 'INTERFACE', name: 'IUserRepository', codebase: 'demo-app', description: 'User repository interface', path: '/src/interfaces/IUserRepository.ts' },
  { type: 'CONSTANT', name: 'API_ENDPOINTS', codebase: 'demo-app', description: 'API endpoint constants', path: '/src/constants/api.js' },

  // Visualization Project  
  { type: 'SYSTEM', name: 'Graph Visualizer', codebase: 'graph-visualizer', description: 'D3.js graph visualization system' },
  { type: 'CLASS', name: 'GraphVisualizer', codebase: 'graph-visualizer', description: 'Main visualization class', path: '/public/visualization.js' },
  { type: 'FUNCTION', name: 'updateGraph', codebase: 'graph-visualizer', description: 'Updates the D3 graph visualization', path: '/public/visualization.js' },
  { type: 'FUNCTION', name: 'applyFilters', codebase: 'graph-visualizer', description: 'Applies filters to graph data', path: '/public/visualization.js' },
  { type: 'MODULE', name: 'Server API', codebase: 'graph-visualizer', description: 'Express.js API server', path: '/server.js' },
  { type: 'FILE', name: 'styles.css', codebase: 'graph-visualizer', description: 'CSS styles for the interface', path: '/public/styles.css' }
];

const sampleRelationships = [
  // Demo App relationships
  { type: 'CONTAINS', source: 'Demo Web App', target: 'User Module' },
  { type: 'CONTAINS', source: 'Demo Web App', target: 'Auth Module' },
  { type: 'CONTAINS', source: 'User Module', target: 'UserService' },
  { type: 'CONTAINS', source: 'Auth Module', target: 'AuthController' },
  { type: 'DEPENDS_ON', source: 'UserService', target: 'IUserRepository' },
  { type: 'DEPENDS_ON', source: 'AuthController', target: 'UserService' },
  { type: 'CALLS', source: 'AuthController', target: 'validateUser' },
  { type: 'CALLS', source: 'AuthController', target: 'hashPassword' },
  { type: 'DEPENDS_ON', source: 'UserService', target: 'database.js' },
  { type: 'USES', source: 'AuthController', target: 'API_ENDPOINTS' },
  { type: 'IMPLEMENTS', source: 'UserService', target: 'IUserRepository' },

  // Graph Visualizer relationships
  { type: 'CONTAINS', source: 'Graph Visualizer', target: 'GraphVisualizer' },
  { type: 'CONTAINS', source: 'Graph Visualizer', target: 'Server API' },
  { type: 'CONTAINS', source: 'GraphVisualizer', target: 'updateGraph' },
  { type: 'CONTAINS', source: 'GraphVisualizer', target: 'applyFilters' },
  { type: 'CALLS', source: 'GraphVisualizer', target: 'updateGraph' },
  { type: 'CALLS', source: 'GraphVisualizer', target: 'applyFilters' },
  { type: 'DEPENDS_ON', source: 'GraphVisualizer', target: 'styles.css' }
];

const sampleTasks = [
  { name: 'Implement user registration', description: 'Add user registration functionality with validation', status: 'TODO', progress: 0, relatedComponents: ['UserService', 'validateUser'] },
  { name: 'Add password reset feature', description: 'Implement password reset via email', status: 'IN_PROGRESS', progress: 0.6, relatedComponents: ['AuthController', 'hashPassword'] },
  { name: 'Improve graph performance', description: 'Optimize D3.js rendering for large graphs', status: 'TODO', progress: 0, relatedComponents: ['GraphVisualizer', 'updateGraph'] },
  { name: 'Add dark mode', description: 'Implement dark theme for the interface', status: 'DONE', progress: 1, relatedComponents: ['styles.css'] },
  { name: 'Database migration', description: 'Migrate from SQLite to PostgreSQL', status: 'BLOCKED', progress: 0.3, relatedComponents: ['database.js'] },
  { name: 'API documentation', description: 'Document all REST endpoints', status: 'IN_PROGRESS', progress: 0.8, relatedComponents: ['Server API', 'API_ENDPOINTS'] }
];

async function clearDatabase() {
  const session = driver.session();
  try {
    // Clear all data except change history
    await session.run('MATCH (n) WHERE NOT (n:ChangeEvent OR n:Snapshot) DETACH DELETE n');
    console.log('✓ Database cleared');
  } finally {
    await session.close();
  }
}

async function createComponents() {
  const session = driver.session();
  const componentMap = new Map();
  
  try {
    console.log('Creating components...');
    
    for (const comp of sampleComponents) {
      const id = uuidv4();
      componentMap.set(comp.name, id);
      
      await session.run(`
        CREATE (c:Component:${comp.type})
        SET c = $properties
        RETURN c
      `, { 
        properties: {
          id,
          type: comp.type,
          name: comp.name,
          codebase: comp.codebase,
          description: comp.description || '',
          path: comp.path || '',
          createdAt: new Date().toISOString()
        }
      });
    }
    
    console.log(`✓ Created ${sampleComponents.length} components`);
    return componentMap;
  } finally {
    await session.close();
  }
}

async function createRelationships(componentMap) {
  const session = driver.session();
  
  try {
    console.log('Creating relationships...');
    
    for (const rel of sampleRelationships) {
      const sourceId = componentMap.get(rel.source);
      const targetId = componentMap.get(rel.target);
      
      if (sourceId && targetId) {
        await session.run(`
          MATCH (source:Component {id: $sourceId})
          MATCH (target:Component {id: $targetId})
          CREATE (source)-[r:${rel.type}]->(target)
          SET r = $properties
          RETURN r
        `, { 
          sourceId, 
          targetId,
          properties: {
            id: uuidv4(),
            createdAt: new Date().toISOString()
          }
        });
      }
    }
    
    console.log(`✓ Created ${sampleRelationships.length} relationships`);
  } finally {
    await session.close();
  }
}

async function createTasks(componentMap) {
  const session = driver.session();
  
  try {
    console.log('Creating tasks...');
    
    for (const task of sampleTasks) {
      const taskId = uuidv4();
      
      await session.run(`
        CREATE (t:Task)
        SET t = $properties
        RETURN t
      `, { 
        properties: {
          id: taskId,
          name: task.name,
          description: task.description,
          status: task.status,
          progress: task.progress,
          createdAt: new Date().toISOString()
        }
      });
      
      // Link to related components
      if (task.relatedComponents && task.relatedComponents.length > 0) {
        const componentIds = task.relatedComponents
          .map(name => componentMap.get(name))
          .filter(Boolean);
          
        if (componentIds.length > 0) {
          await session.run(`
            MATCH (t:Task {id: $taskId})
            MATCH (c:Component)
            WHERE c.id IN $componentIds
            CREATE (t)-[:RELATES_TO]->(c)
          `, { taskId, componentIds });
        }
      }
    }
    
    console.log(`✓ Created ${sampleTasks.length} tasks`);
  } finally {
    await session.close();
  }
}

async function verifyData() {
  const session = driver.session();
  
  try {
    const components = await session.run('MATCH (c:Component) RETURN count(c) as count');
    const relationships = await session.run('MATCH ()-[r]->() WHERE type(r) <> "RELATES_TO" RETURN count(r) as count');
    const tasks = await session.run('MATCH (t:Task) RETURN count(t) as count');
    const taskRelations = await session.run('MATCH ()-[r:RELATES_TO]->() RETURN count(r) as count');
    
    console.log('\\n📊 Data Summary:');
    console.log(`   Components: ${components.records[0].get('count').toNumber()}`);
    console.log(`   Relationships: ${relationships.records[0].get('count').toNumber()}`);
    console.log(`   Tasks: ${tasks.records[0].get('count').toNumber()}`);
    console.log(`   Task Relations: ${taskRelations.records[0].get('count').toNumber()}`);
  } finally {
    await session.close();
  }
}

async function main() {
  try {
    console.log('🚀 Starting demo data population...');
    
    // Test connection
    const session = driver.session();
    await session.run('RETURN 1');
    await session.close();
    console.log('✓ Neo4j connection established');
    
    // Clear and populate
    await clearDatabase();
    const componentMap = await createComponents();
    await createRelationships(componentMap);
    await createTasks(componentMap);
    await verifyData();
    
    console.log('\\n🎉 Demo data population complete!');
    console.log('\\n🔗 Next steps:');
    console.log('   1. Start the visualizer: npm start');
    console.log('   2. Open http://localhost:3000');
    console.log('   3. Explore the sample graph data');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await driver.close();
  }
}

// Check if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
