import puppeteer from 'puppeteer';

// Helper function to replace deprecated waitForTimeout
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testTaskManagement() {
  let browser;
  
  try {
    console.log('Starting Puppeteer test...');
    
    browser = await puppeteer.launch({
      headless: false, // Set to true for production
      defaultViewport: { width: 1200, height: 800 }
    });
    
    const page = await browser.newPage();
    
    // Navigate to the tasks page
    console.log('Navigating to tasks page...');
    await page.goto('http://localhost:3000/tasks.html', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    // Wait for the TaskManager to be initialized
    await page.waitForFunction(() => window.taskManager !== undefined, { timeout: 5000 });
    
    console.log('TaskManager initialized, running tests...');
    
    // Test 1: Check initial view mode
    await testInitialState(page);
    
    // Test 2: Switch to progress view and analyze
    await testProgressView(page);
    
    // Test 3: Test scrolling behavior
    await testScrolling(page);
    
    // Test 4: Check average progress calculation
    await testAverageProgress(page);
    
    // Test 5: Test task ordering by last update
    await testTaskOrdering(page);
    
    console.log('All tests completed!');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function testInitialState(page) {
  console.log('\n=== Testing Initial State ===');
  
  // Check if TaskManager is available
  const hasTaskManager = await page.evaluate(() => {
    return typeof window.taskManager !== 'undefined';
  });
  
  console.log('TaskManager available:', hasTaskManager);
  
  // Get initial task count
  const taskCount = await page.evaluate(() => {
    return window.taskManager.tasks.length;
  });
  
  console.log('Initial task count:', taskCount);
  
  // Check current view mode
  const currentView = await page.evaluate(() => {
    return window.taskManager.currentView;
  });
  
  console.log('Current view mode:', currentView);
}

async function testProgressView(page) {
  console.log('\n=== Testing Progress View ===');
  
  // Switch to progress view
  await page.click('#progressViewBtn');
  await delay(500);
  
  // Check if progress view is active
  const isProgressViewActive = await page.evaluate(() => {
    const progressContainer = document.getElementById('progress-view');
    const taskContainer = document.querySelector('.task-container');
    return progressContainer.style.display !== 'none' && taskContainer.style.display === 'none';
  });
  
  console.log('Progress view active:', isProgressViewActive);
  
  // Get progress view stats
  const progressStats = await page.evaluate(() => {
    const totalCount = document.getElementById('progress-total-count')?.textContent || 'N/A';
    const avgProgress = document.getElementById('progress-completion-rate')?.textContent || 'N/A';
    return { totalCount, avgProgress };
  });
  
  console.log('Progress stats:', progressStats);
}

async function testScrolling(page) {
  console.log('\n=== Testing Scrolling Behavior ===');
  
  // Get the progress container
  const progressContainer = await page.$('#progress-view');
  if (!progressContainer) {
    console.log('Progress container not found');
    return;
  }
  
  // Get container dimensions and scroll info
  const scrollInfo = await page.evaluate(() => {
    const container = document.querySelector('#progress-view');
    if (!container) return null;
    
    return {
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
      scrollTop: container.scrollTop,
      overflow: getComputedStyle(container).overflow,
      overflowY: getComputedStyle(container).overflowY
    };
  });
  
  console.log('Scroll info:', scrollInfo);
  
  // Test scrolling if content is scrollable
  if (scrollInfo && scrollInfo.scrollHeight > scrollInfo.clientHeight) {
    console.log('Content is scrollable, testing scroll...');
    
    // Scroll down
    await page.evaluate(() => {
      const container = document.querySelector('#progress-view');
      if (container) {
        container.scrollTop = 100;
      }
    });
    
    await delay(200);
    
    const newScrollTop = await page.evaluate(() => {
      const container = document.querySelector('#progress-view');
      return container ? container.scrollTop : 0;
    });
    
    console.log('Scroll test - new scrollTop:', newScrollTop);
  } else {
    console.log('Content is not scrollable or container not found');
  }
}

async function testAverageProgress(page) {
  console.log('\n=== Testing Average Progress Calculation ===');
  
  // Get all tasks and their progress values
  const progressData = await page.evaluate(() => {
    if (!window.taskManager) return null;
    
    const tasks = window.taskManager.tasks;
    const progressValues = tasks.map(task => ({
      name: task.name,
      progress: task.progress,
      progressPercent: Math.round((task.progress || 0) * 100)
    }));
    
    // Calculate our own average using normalized progress (same logic as in the app)
    const normalizedProgress = tasks.map(task => {
      let progress = task.progress || 0;
      // If progress is greater than 1, assume it's a percentage and convert to decimal
      if (progress > 1) {
        progress = progress / 100;
      }
      // Cap at 1.0 (100%)
      return Math.min(progress, 1.0);
    });
    
    const avgProgress = normalizedProgress.length > 0 ? normalizedProgress.reduce((sum, progress) => sum + progress, 0) / normalizedProgress.length : 0;
    const avgProgressPercent = Math.min(Math.round(avgProgress * 100), 100);
    
    // Get displayed average
    const displayedAvg = document.getElementById('progress-completion-rate')?.textContent;
    
    return {
      progressValues,
      calculatedAverage: avgProgressPercent,
      displayedAverage: displayedAvg,
      taskCount: tasks.length
    };
  });
  
  console.log('Progress calculation data:', progressData);
  
  if (progressData) {
    console.log(`Manual calculation: ${progressData.calculatedAverage}%`);
    console.log(`Displayed: ${progressData.displayedAverage}`);
    
    // Check if they match
    const matches = progressData.displayedAverage.includes(`${progressData.calculatedAverage}%`);
    console.log('Progress calculation matches:', matches);
  }
}

async function testTaskOrdering(page) {
  console.log('\n=== Testing Task Ordering ===');
  
  // Get task ordering information
  const orderingData = await page.evaluate(() => {
    if (!window.taskManager) return null;
    
    // Get the order of tasks as displayed in the progress view
    const taskRows = Array.from(document.querySelectorAll('.progress-task-row'));
    const displayedOrder = taskRows.map(row => ({
      taskId: row.getAttribute('data-task-id'),
      taskName: row.querySelector('.progress-task-title')?.textContent,
      status: row.getAttribute('data-status'),
      lastUpdated: row.querySelector('.progress-task-updated')?.textContent
    }));
    
    // Get tasks with their real timestamps and calculate expected order using same logic as frontend
    const tasksWithTimestamps = window.taskManager.tasks.map(task => ({
      id: task.id,
      name: task.name,
      status: task.status,
      timestamp: task.updatedAt || task.lastModified || task.createdAt || task.created || null,
      displayTime: window.taskManager.formatTimestamp(task.updatedAt || task.lastModified || task.createdAt || task.created)
    }));
    
    // Sort by real timestamp (newest first) using same logic as frontend
    const expectedOrder = tasksWithTimestamps.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    return {
      displayedOrder,
      expectedOrder: expectedOrder.map(task => ({
        id: task.id,
        name: task.name,
        status: task.status,
        timestamp: task.timestamp,
        displayTime: task.displayTime
      }))
    };
  });
  
  console.log('Task ordering data:');
  console.log('Displayed order:', orderingData?.displayedOrder);
  console.log('Expected order (by real timestamp):', orderingData?.expectedOrder);
  
  // Check if ordering matches expectations
  if (orderingData && orderingData.displayedOrder.length > 0) {
    const orderMatches = orderingData.displayedOrder.every((displayedTask, index) => {
      const expectedTask = orderingData.expectedOrder[index];
      return displayedTask.taskId === expectedTask.id;
    });
    
    console.log('Task ordering matches expected (by real timestamp):', orderMatches);
    
    if (!orderMatches) {
      console.log('First few tasks in displayed order:');
      orderingData.displayedOrder.slice(0, 3).forEach((task, i) => {
        console.log(`  ${i + 1}. ${task.taskName} (${task.status}) - ${task.lastUpdated}`);
      });
      
      console.log('First few tasks in expected order:');
      orderingData.expectedOrder.slice(0, 3).forEach((task, i) => {
        console.log(`  ${i + 1}. ${task.name} (${task.status}) - ${task.displayTime} (${task.timestamp})`);
      });
    }
  }
}

// Add error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the test
testTaskManagement().catch(console.error);
