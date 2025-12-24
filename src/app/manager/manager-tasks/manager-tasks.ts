import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  assigned_to: number; // Ensure this is number
  assigned_to_name: string;
  assigned_by_name: string;
  priority: 'low' | 'medium' | 'high';
  status: string;
  due_date: string;
  estimated_hours: number;
  time_spent: number;
  progress_percent: number;
  created_at: string;
  is_overdue?: boolean;
  time_remaining?: number;
  project_name?: string;
  project_client?: string;
}

interface EmployeeTaskStats {
  employee: Employee;
  completedCount: number;
  pendingCount: number;
  totalCount: number;
}

interface EmployeeTaskDetails {
  employee: Employee;
  tasks: Task[];
  completedCount: number;
  pendingCount: number;
  totalTasks: number;
  selectedDate: Date;
}

@Component({
  selector: 'app-manager-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './manager-tasks.html',
  styleUrl: './manager-tasks.scss'
})
export class ManagerTasksComponent implements OnInit {
  employees: Employee[] = [];
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  user: any;
  
  // Filter properties
  selectedEmployeeFilter: string = 'all';
  taskFilter: string = 'all';
  timeRangeFilter: string = 'lifetime';
  
  // Statistics properties
  totalTasks: number = 0;
  pendingTasks: number = 0;
  completedTasks: number = 0;
  inProgressTasks: number = 0;
  overdueTasks: number = 0;

  // Properties for tabs and filtering
  activeTab: string = 'employees';
  showEmployeeModal: boolean = false;
  isLoading: boolean = false;

  // New properties for calendar view
  selectedDate: Date = new Date();
  calendarDays: Date[] = [];
  showEmployeeDetailsModal: boolean = false;
  selectedEmployeeTasks: EmployeeTaskDetails | null = null;
  employeeTaskStats: Map<string, EmployeeTaskStats> = new Map();

  // New properties for employee task details modal
  showEmployeeTaskDetailsModal: boolean = false;
  selectedEmployee: Employee | null = null;

  // Properties for new employee
  newEmployee = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'employee'
  };

  // Properties for new task
  newTask = {
    title: '',
    description: '',
    assigned_to: 0,
    priority: 'medium' as 'low' | 'medium' | 'high',
    due_date: '',
    estimated_hours: 1,
    project_name: '',
    client_name: ''
  };

  // private readonly API_URL = this.getApiUrl();

  // private getApiUrl(): string {
  //   const currentUrl = window.location.href;
  //   if (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
  //     return 'http://localhost:3000/api';
  //   } else {
  //     return '/api';
  //   }
  // }

    private API_URL = this.getApiUrl();

  private getApiUrl(): string {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
      }
    }
    return 'https://xtro-edge-task-manager-backend.vercel.app/api';
  }


  constructor(
    private http: HttpClient,
    private router: Router
  ) { }

  ngOnInit() {
    const userData = localStorage.getItem('user');
    if (!userData) {
      this.router.navigate(['/login']);
      return;
    }

    this.user = JSON.parse(userData);
    if (this.user.role !== 'manager') {
      this.router.navigate(['/tasks']);
      return;
    }

    this.loadInitialData();
  }

  // Fixed: Proper sequential loading with type conversion
  async loadInitialData() {
    this.isLoading = true;
    
    try {
      // Pehle employees load karo
      await this.loadEmployees();
      // console.log('✅ Employees loaded successfully:', this.employees);
      
      // Phir tasks load karo
      await this.loadTasks();
      // console.log('✅ Tasks loaded successfully:', this.tasks);
      
      this.generateCalendarDays();
      this.applyAllFilters(); // Initial filter apply karo
      
    } catch (error) {
      console.error('❌ Error loading initial data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Fixed: Convert to async/await
  async loadEmployees(): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = localStorage.getItem('token');

      this.http.get<Employee[]>(`${this.API_URL}/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).subscribe({
        next: (employees) => {
          // Ensure employee IDs are numbers
          this.employees = employees.map(emp => ({
            ...emp,
            id: Number(emp.id) // Convert to number
          }));
          // console.log('📥 Employees loaded:', this.employees.length);
          resolve();
        },
        error: (err) => {
          console.error('❌ Failed to load employees:', err);
          reject(err);
        }
      });
    });
  }

  // Fixed: Convert to async/await with type conversion
  async loadTasks(): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = localStorage.getItem('token');
      
      this.http.get<Task[]>(`${this.API_URL}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).subscribe({
        next: (tasks) => {
          // FIX: Ensure all IDs are numbers
          this.tasks = tasks.map(task => ({
            ...this.calculateTaskTime(task),
            assigned_to: Number(task.assigned_to), // Convert to number
            id: Number(task.id) // Convert to number
          }));
          this.filteredTasks = [...this.tasks];
          // console.log('📥 Tasks loaded:', this.tasks.length);
          this.calculateStatistics();
          this.calculateEmployeeTaskStats();
          resolve();
        },
        error: (err) => {
          console.error('❌ Failed to load tasks:', err);
          reject(err);
        }
      });
    });
  }

  calculateStatistics() {
    this.totalTasks = this.tasks.length;
    this.pendingTasks = this.tasks.filter(t => t.status === 'pending').length;
    this.completedTasks = this.tasks.filter(t => t.status === 'completed').length;
    this.inProgressTasks = this.tasks.filter(t => t.status === 'in_progress').length;
    this.overdueTasks = this.tasks.filter(t => t.is_overdue).length;
  }

  calculateTaskTime(task: Task): Task {
    const now = new Date().getTime();
    const dueDate = new Date(task.due_date).getTime();
    const timeRemaining = dueDate - now;
    
    return {
      ...task,
      time_remaining: Math.max(0, timeRemaining),
      is_overdue: timeRemaining < 0 && task.status !== 'completed'
    };
  }

  // Calculate employee task statistics for each day
  calculateEmployeeTaskStats() {
    this.employeeTaskStats.clear();

    this.calendarDays.forEach(day => {
      this.employees.forEach(employee => {
        const tasksForEmployee = this.getEmployeeTasksForDate(employee.id, day);
        const completedCount = tasksForEmployee.filter(t => t.status === 'completed').length;
        const pendingCount = tasksForEmployee.filter(t => t.status !== 'completed').length;
        const totalCount = tasksForEmployee.length;

        const key = `${employee.id}-${day.toDateString()}`;
        this.employeeTaskStats.set(key, {
          employee: employee,
          completedCount: completedCount,
          pendingCount: pendingCount,
          totalCount: totalCount
        });
      });
    });
  }

  // Get task stats for employee on specific date
  getEmployeeTaskStats(employeeId: number, date: Date): EmployeeTaskStats {
    const key = `${employeeId}-${date.toDateString()}`;
    const stats = this.employeeTaskStats.get(key);

    if (stats) {
      return stats;
    }

    // Return default stats if not found
    const employee = this.employees.find(emp => emp.id === employeeId);
    return {
      employee: employee || { id: 0, name: '', email: '', role: '', created_at: '' },
      completedCount: 0,
      pendingCount: 0,
      totalCount: 0
    };
  }

  // Calendar functions - Generate Monday to Sunday week
  generateCalendarDays() {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Calculate Monday of current week
    const monday = new Date(today);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday

    monday.setDate(diff);

    // Generate 7 days from Monday to Sunday
    this.calendarDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      this.calendarDays.push(date);
    }
  }

  // Get tasks for a specific date
  getTasksForDate(date: Date): Task[] {
    const dateStr = this.formatDateForComparison(date);
    return this.tasks.filter(task => {
      const taskDate = this.formatDateForComparison(new Date(task.due_date));
      return taskDate === dateStr;
    });
  }

  // Format date for comparison (YYYY-MM-DD)
  formatDateForComparison(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // Get unique employees with tasks for a specific date
  getEmployeesWithTasks(date: Date): Employee[] {
    const tasksForDate = this.getTasksForDate(date);
    const employeeIds = [...new Set(tasksForDate.map(task => task.assigned_to))];
    return this.employees.filter(emp => employeeIds.includes(emp.id));
  }

  // Get employee tasks for specific date
  getEmployeeTasksForDate(employeeId: number, date: Date): Task[] {
    const dateStr = this.formatDateForComparison(date);
    return this.tasks.filter(task => {
      const taskDate = this.formatDateForComparison(new Date(task.due_date));
      return task.assigned_to === employeeId && taskDate === dateStr;
    });
  }

  // Show employee details for calendar view
  showEmployeeDetails(employee: Employee, date: Date) {
    const tasksForDate = this.getEmployeeTasksForDate(employee.id, date);
    const completedCount = tasksForDate.filter(task => task.status === 'completed').length;
    const pendingCount = tasksForDate.filter(task => task.status !== 'completed').length;
    const totalTasks = this.tasks.filter(task => task.assigned_to === employee.id).length;

    this.selectedEmployeeTasks = {
      employee: employee,
      tasks: tasksForDate,
      completedCount: completedCount,
      pendingCount: pendingCount,
      totalTasks: totalTasks,
      selectedDate: date
    };

    this.showEmployeeDetailsModal = true;
  }

  // Close employee details modal for calendar view
  closeEmployeeDetailsModal() {
    this.showEmployeeDetailsModal = false;
    this.selectedEmployeeTasks = null;
  }

  // Show employee task details when clicking on employee name in view all tasks
  showEmployeeTaskDetails(employeeId: number) {
    this.selectedEmployee = this.employees.find(emp => emp.id === employeeId) || null;
    if (this.selectedEmployee) {
      this.showEmployeeTaskDetailsModal = true;
    }
  }

  // Close employee task details modal
  closeEmployeeTaskDetailsModal() {
    this.showEmployeeTaskDetailsModal = false;
    this.selectedEmployee = null;
  }

  // Get tasks for selected employee
  getEmployeeTasks(): Task[] {
    if (!this.selectedEmployee) return [];
    return this.tasks.filter(task => task.assigned_to === this.selectedEmployee!.id);
  }

  // Get task statistics for selected employee
  getEmployeeTaskStatsForModal(): { total: number, completed: number, pending: number } {
    const employeeTasks = this.getEmployeeTasks();
    return {
      total: employeeTasks.length,
      completed: employeeTasks.filter(task => task.status === 'completed').length,
      pending: employeeTasks.filter(task => task.status !== 'completed').length
    };
  }

  // Assign task to the selected employee
  assignTaskToEmployee() {
    if (this.selectedEmployee) {
      this.activeTab = 'tasks';
      this.newTask.assigned_to = this.selectedEmployee.id;
      this.closeEmployeeTaskDetailsModal();

      // Scroll to task form
      setTimeout(() => {
        const taskFormElement = document.querySelector('.task-form-card');
        if (taskFormElement) {
          taskFormElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }

  // Format date for display
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }

  // Format day name only
  formatDayName(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long'
    });
  }

  // Check if date is today
  isToday(date: Date): boolean {
    return date.toDateString() === new Date().toDateString();
  }

  // Check if date is in the past
  isPastDate(date: Date): boolean {
    return date < new Date() && !this.isToday(date);
  }

  // Check if date is in the future
  isFutureDate(date: Date): boolean {
    return date > new Date();
  }

  // Open employee registration modal
  openEmployeeModal() {
    this.showEmployeeModal = true;
    this.resetEmployeeForm();
  }

  // Close employee registration modal
  closeEmployeeModal() {
    this.showEmployeeModal = false;
    this.resetEmployeeForm();
  }

  // Reset employee form
  resetEmployeeForm() {
    this.newEmployee = {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'employee'
    };
  }

  // Create new employee
  createEmployee() {
    if (!this.newEmployee.name || !this.newEmployee.email || !this.newEmployee.password) {
      alert('Please fill all required fields');
      return;
    }

    if (this.newEmployee.password !== this.newEmployee.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (this.newEmployee.password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    const token = localStorage.getItem('token');
    const { confirmPassword, ...employeeData } = this.newEmployee;

    this.http.post(`${this.API_URL}/employees`, employeeData, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (response: any) => {
        console.log('Employee created successfully:', response);
        // Ensure new employee ID is number
        const newEmployee = {
          ...response.employee,
          id: Number(response.employee.id)
        };
        this.employees.push(newEmployee);
        this.calculateEmployeeTaskStats();
        this.closeEmployeeModal();
        alert('Employee created successfully!');
        
        // Refresh filters after adding new employee
        this.applyAllFilters();
      },
      error: (err) => {
        console.error('Failed to create employee:', err);
        alert('Failed to create employee: ' + (err.error?.error || 'Unknown error'));
      }
    });
  }

  assignTask() {
    if (!this.newTask.title || !this.newTask.assigned_to || !this.newTask.due_date) {
      alert('Please fill all required fields');
      return;
    }

    const token = localStorage.getItem('token');
    
    this.http.post<Task>(`${this.API_URL}/tasks`, this.newTask, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (task) => {
        // Ensure new task has proper number types
        const newTask = {
          ...task,
          assigned_to: Number(task.assigned_to),
          id: Number(task.id)
        };
        this.tasks.push(newTask);
        this.filteredTasks = [...this.tasks];
        this.calculateStatistics();
        this.calculateEmployeeTaskStats();
        this.resetTaskForm();
        alert('Task assigned successfully!');
        
        // Refresh filters after adding new task
        this.applyAllFilters();
      },
      error: (err) => {
        console.error('Failed to assign task:', err);
        alert('Failed to assign task: ' + (err.error?.error || 'Unknown error'));
      }
    });
  }

  deleteTask(task: Task) {
    if (confirm(`Are you sure you want to delete task: ${task.title}?`)) {
      const token = localStorage.getItem('token');
      
      this.http.delete(`${this.API_URL}/tasks/${task.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).subscribe({
        next: () => {
          this.tasks = this.tasks.filter(t => t.id !== task.id);
          this.filteredTasks = this.filteredTasks.filter(t => t.id !== task.id);
          this.calculateStatistics();
          this.calculateEmployeeTaskStats();
          alert('Task deleted successfully!');
          
          // Refresh filters after deleting task
          this.applyAllFilters();
        },
        error: (err) => {
          console.error('Failed to delete task:', err);
          alert('Failed to delete task');
        }
      });
    }
  }

  resetTaskForm() {
    this.newTask = {
      title: '',
      description: '',
      assigned_to: 0,
      priority: 'medium',
      due_date: '',
      estimated_hours: 1,
      project_name: '',
      client_name: ''
    };
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'completed': return 'status-completed';
      case 'in_progress': return 'status-in-progress';
      case 'overdue': return 'status-overdue';
      default: return 'status-pending';
    }
  }

  viewTaskProgress(task: Task) {
    console.log('View progress for task:', task);
    alert(`Viewing progress for: ${task.title}\nProgress: ${task.progress_percent}%\nTime Spent: ${task.time_spent || 0}h`);
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    this.router.navigate(['/login']);
  }

  // Get day color based on date status
  getDayColor(date: Date): string {
    if (this.isToday(date)) return 'today';
    if (this.isPastDate(date)) return 'past';
    if (this.isFutureDate(date)) return 'future';
    return '';
  }

  // Filter tasks by time range
  filterTasksByTimeRange(tasks: Task[]): Task[] {
    const now = new Date();
    
    switch (this.timeRangeFilter) {
      case 'today':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return tasks.filter(task => {
          const taskDate = new Date(task.due_date);
          taskDate.setHours(0, 0, 0, 0);
          return taskDate.getTime() === today.getTime();
        });
        
      case 'yesterday':
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        return tasks.filter(task => {
          const taskDate = new Date(task.due_date);
          taskDate.setHours(0, 0, 0, 0);
          return taskDate.getTime() === yesterday.getTime();
        });
        
      case 'week':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return tasks.filter(task => new Date(task.due_date) >= weekAgo);
        
      case 'month':
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return tasks.filter(task => new Date(task.due_date) >= monthAgo);
        
      case 'year':
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        return tasks.filter(task => new Date(task.due_date) >= yearAgo);
        
      case 'lifetime':
      default:
        return tasks;
    }
  }

  // FIXED: Main filter function with proper type handling
  filterTasks() {
    // console.log('🔄 === STARTING FILTER PROCESS ===');
    
    let filtered = this.filterTasksByTimeRange(this.tasks);
    // console.log('⏰ After time range filter:', filtered.length, 'tasks');

    // Apply status filter
    if (this.taskFilter !== 'all') {
      // console.log('📊 Applying status filter:', this.taskFilter);
      if (this.taskFilter === 'overdue') {
        filtered = filtered.filter(task => task.is_overdue);
        // console.log('⚠️ After overdue filter:', filtered.length, 'tasks');
      } else {
        filtered = filtered.filter(task => task.status === this.taskFilter);
        // console.log('📋 After status filter:', filtered.length, 'tasks');
      }
    }

    // FIXED: Apply employee filter with proper type conversion
    if (this.selectedEmployeeFilter !== 'all') {
      // console.log('👤 Applying employee filter:', this.selectedEmployeeFilter);
      
      // String ko number mein convert karo
      const employeeId = parseInt(this.selectedEmployeeFilter);
      // console.log('🔢 Converted employee ID:', employeeId, 'Type:', typeof employeeId);
      
      // Debug: Check if employee exists
      const employeeExists = this.employees.find(emp => emp.id === employeeId);
      // console.log('👥 Employee exists:', employeeExists);
      
      // Debug: Check tasks before filtering
      // console.log('📋 Tasks before employee filter:', filtered.map(t => ({id: t.id, assigned_to: t.assigned_to, assigned_to_type: typeof t.assigned_to})));
      
      // FIX: Use strict number comparison
      filtered = filtered.filter(task => {
        const taskAssignedTo = Number(task.assigned_to); // Ensure it's number
        const matches = taskAssignedTo === employeeId;
        // console.log(`🔍 Task ${task.id}: assigned_to=${taskAssignedTo} (${typeof taskAssignedTo}) vs employeeId=${employeeId} (${typeof employeeId}) -> matches=${matches}`);
        return matches;
      });
      
      // console.log('✅ After employee filter:', filtered.length, 'tasks');
    }

    // console.log('🎯 Final filtered tasks count:', filtered.length);
    this.filteredTasks = filtered;
    
    // Final debug
    this.debugFilters();
    // console.log('🔄 === FILTER PROCESS COMPLETED ===');
  }

  // Apply all filters
  applyAllFilters() {
    // console.log('🎛️ Applying all filters...');
    this.filterTasks();
  }

  // Get completed tasks count for filtered employee
  getFilteredEmployeeCompletedTasks(): number {
    if (this.selectedEmployeeFilter === 'all') return 0;
    
    const employeeId = parseInt(this.selectedEmployeeFilter);
    const filteredTasks = this.filterTasksByTimeRange(this.tasks);
    
    return filteredTasks.filter(task =>
      Number(task.assigned_to) === employeeId && task.status === 'completed'
    ).length;
  }

  // Get pending tasks count for filtered employee
  getFilteredEmployeePendingTasks(): number {
    if (this.selectedEmployeeFilter === 'all') return 0;
    
    const employeeId = parseInt(this.selectedEmployeeFilter);
    const filteredTasks = this.filterTasksByTimeRange(this.tasks);
    
    return filteredTasks.filter(task =>
      Number(task.assigned_to) === employeeId && task.status !== 'completed'
    ).length;
  }
    // NAVIGATION METHODS
  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  navigateToDashboard() {
    this.router.navigate(['/dashboard']);
  }
  navigateToProgress() {
    this.router.navigate(['/progress']);
  }

  // Format time remaining for display
  formatTimeRemaining(milliseconds: number): string {
    if (milliseconds <= 0) return 'Overdue';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // Debug function to check filter values
  debugFilters() {
    // console.log('🔍 === DEBUG FILTERS ===');
    // console.log('Selected Employee Filter:', this.selectedEmployeeFilter, typeof this.selectedEmployeeFilter);
    // console.log('Task Filter:', this.taskFilter);
    // console.log('Time Range Filter:', this.timeRangeFilter);
    // console.log('Total Employees:', this.employees.length);
    // console.log('Total Tasks:', this.tasks.length);
    // console.log('Filtered Tasks:', this.filteredTasks.length);
    
    // Log all employees with their IDs
    // console.log('👥 Employees List:');
    this.employees.forEach(emp => {
      // console.log(`  - ${emp.id}: ${emp.name} (${typeof emp.id})`);
    });
    
    // Log tasks with assigned_to
    // console.log('📋 Tasks with assigned_to:');
    this.tasks.forEach(task => {
      // console.log(`  - Task ${task.id}: "${task.title}" -> assigned_to: ${task.assigned_to} (${typeof task.assigned_to})`);
    });
    
    // console.log('🎯 Current Filtered Tasks:');
    this.filteredTasks.forEach(task => {
      // console.log(`  - Task ${task.id}: "${task.title}" -> assigned_to: ${task.assigned_to}`);
    });
    
    // console.log('=== END DEBUG ===');
  }




  
// Format full date: Monday, 22 Dec 2025
formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// Get completed tasks for specific date
getCompletedTasksForDate(date: Date): number {
  const tasks = this.getTasksForDate(date);
  return tasks.filter(task => task.status === 'completed').length;
}

// Get pending tasks for specific date
getPendingTasksForDate(date: Date): number {
  const tasks = this.getTasksForDate(date);
  return tasks.filter(task => task.status === 'pending').length;
}

// Get in-progress tasks for specific date
getInProgressTasksForDate(date: Date): number {
  const tasks = this.getTasksForDate(date);
  return tasks.filter(task => task.status === 'in_progress').length;
}
}