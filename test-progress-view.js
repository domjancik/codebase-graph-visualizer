import puppeteer from 'puppeteer';

async function testProgressView() {
  const browser = await puppeteer.launch({ 
    headless: false, 
    devtools: true,
    args: ['--window-size=1200,800']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    
    console.log('📍 Opening tasks page...');
    await page.goto('http://localhost:3000/tasks.html', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    // Wait for tasks to load
    await page.waitForSelector('.task-board', { timeout: 5000 });
    console.log('✅ Tasks page loaded');
    
    // Switch to progress view
    console.log('🔄 Switching to progress rows view...');
    await page.click('#progressViewBtn');
    await page.waitForSelector('.progress-container', { visible: true, timeout: 3000 });
    console.log('✅ Progress view activated');
    
    // Check if progress container is visible and scrollable
    const progressContainer = await page.evaluate(() => {
      const container = document.getElementById('progress-view');
      const taskList = document.getElementById('progress-task-list');
      if (!container || !taskList) return null;
      
      const containerStyles = window.getComputedStyle(container);
      const taskListStyles = window.getComputedStyle(taskList);
      
      return {
        containerDisplay: containerStyles.display,
        containerHeight: containerStyles.height,
        containerOverflow: containerStyles.overflow,
        taskListHeight: taskListStyles.height,
        taskListOverflow: taskListStyles.overflowY,
        taskListScrollHeight: taskList.scrollHeight,
        taskListClientHeight: taskList.clientHeight,
        isScrollable: taskList.scrollHeight > taskList.clientHeight,
        taskCount: taskList.children.length
      };
    });
    
    console.log('📊 Progress container analysis:', progressContainer);
    
    // Check average progress calculation
    const progressStats = await page.evaluate(() => {
      const avgElement = document.getElementById('progress-completion-rate');
      const totalElement = document.getElementById('progress-total-count');
      return {
        avgText: avgElement ? avgElement.textContent : 'Not found',
        totalText: totalElement ? totalElement.textContent : 'Not found'
      };
    });
    
    console.log('📈 Progress statistics:', progressStats);
    
    // Get task data and analyze ordering
    const taskAnalysis = await page.evaluate(() => {
      const taskRows = document.querySelectorAll('.progress-task-row');
      const tasks = [];
      
      taskRows.forEach((row, index) => {
        const title = row.querySelector('.progress-task-title')?.textContent || '';
        const status = row.querySelector('.progress-task-status')?.textContent || '';
        const updated = row.querySelector('.progress-task-updated')?.textContent || '';
        const progress = row.querySelector('.progress-task-progress-text')?.textContent || '';
        
        tasks.push({
          index,
          title: title.substring(0, 30) + (title.length > 30 ? '...' : ''),
          status,
          updated,
          progress
        });
      });
      
      return tasks;
    });
    
    console.log('📋 Task ordering (first 10):');
    taskAnalysis.slice(0, 10).forEach(task => {
      console.log(`  ${task.index + 1}. ${task.title} | ${task.status} | ${task.updated} | ${task.progress}`);
    });
    
    // Test scrolling
    console.log('🖱️  Testing scroll behavior...');
    const scrollTest = await page.evaluate(() => {
      const taskList = document.getElementById('progress-task-list');
      if (!taskList) return { error: 'Task list not found' };
      
      const initialScrollTop = taskList.scrollTop;
      
      // Try to scroll down
      taskList.scrollTop = 200;
      const afterScrollTop = taskList.scrollTop;
      
      // Scroll back to top
      taskList.scrollTop = 0;
      
      return {
        initialScrollTop,
        afterScrollTop,
        scrollWorked: afterScrollTop > initialScrollTop,
        maxScrollTop: taskList.scrollHeight - taskList.clientHeight
      };
    });
    
    console.log('🖱️  Scroll test results:', scrollTest);
    
    // Get raw task data to debug progress calculation
    const rawTaskData = await page.evaluate(() => {
      // Access the TaskManager instance
      const taskManager = window.taskManager || 
        (window.TaskManager && new window.TaskManager()) || 
        null;
      
      if (!taskManager) {
        return { error: 'TaskManager not accessible' };
      }
      
      const tasks = taskManager.tasks || [];
      return tasks.map(task => ({
        name: task.name?.substring(0, 20) + (task.name?.length > 20 ? '...' : ''),
        progress: task.progress,
        progressType: typeof task.progress,
        status: task.status
      })).slice(0, 5);
    });
    
    console.log('🔍 Raw task data sample:', rawTaskData);
    
    // Keep browser open for manual inspection
    console.log('🔍 Browser kept open for manual inspection. Close it when done.');
    await page.waitForTimeout(30000); // Wait 30 seconds for inspection
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testProgressView().catch(console.error);
