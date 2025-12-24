import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';

interface EmployeeProgress {
  id: number;
  name: string;
  email: string;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  monthly_progress: MonthlyProgress[];
}

interface MonthlyProgress {
  month: string;
  year: number;
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  pending_tasks: number;
}

interface TaskStats {
  id: number;
  name: string;
  email: string;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  avg_progress: number;
}

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: number;
  assigned_to_name: string;
  progress_percent: number;
  due_date: string;
  created_at: string;
  is_overdue: boolean;
}

interface TaskStatusStats {
  status: string;
  percentage: number;
  count: number;
  color: string;
  icon: string;
}

@Component({
  selector: 'app-employee-progress',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './progress.html',
  styleUrl: './progress.scss'
})
export class Progress implements OnInit {
  employeesProgress: EmployeeProgress[] = [];
  filteredEmployees: EmployeeProgress[] = [];
  selectedEmployee: EmployeeProgress | null = null;
  selectedMonth: string = 'all';
  isLoading: boolean = false;

  // Tasks data
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  taskStatusStats: TaskStatusStats[] = [];
  totalTasks: number = 0;
  completedTasks: number = 0;
  inProgressTasks: number = 0;
  pendingTasks: number = 0;
  overdueTasks: number = 0;

  // Overview statistics
  totalEmployees: number = 0;
  avgCompletionRate: number = 0;
  totalAssignedTasks: number = 0;
  totalCompletedTasks: number = 0;

  private API_URL = 'https://xtro-edge-task-manager-backend.vercel.app/api';

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
    private router: Router,
  ) {}

  ngOnInit() {
    console.log('🚀 Progress Component Initialized');
    this.API_URL = this.getApiUrl();
    this.loadEmployeeProgress();
    this.loadTasks();
  }

  loadEmployeeProgress() {
    this.isLoading = true;
    const token = localStorage.getItem('token');

    this.http.get<TaskStats[]>(`${this.getApiUrl()}/employees`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (stats) => {
        console.log('📊 Employee Stats API Response:', stats);
        this.processEmployeeData(stats);
      },
      error: (err) => {
        console.error('❌ Failed to load employee progress:', err);
        this.isLoading = false;
      }
    });
  }

  loadTasks() {
    const token = localStorage.getItem('token');

    this.http.get<Task[]>(`${this.getApiUrl()}/tasks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (tasks) => {
        console.log('📋 Tasks API Response:', tasks);
        this.processTasksData(tasks);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('❌ Failed to load tasks:', err);
        this.isLoading = false;
      }
    });
  }

  processEmployeeData(stats: TaskStats[]) {
    console.log('📊 Processing employee data from API:', stats);
    
    this.employeesProgress = stats.map(employee => {
      console.log(`👤 Processing employee: ${employee.name}`, {
        total: employee.total_tasks,
        completed: employee.completed_tasks,
        pending: employee.pending_tasks,
        inProgress: employee.in_progress_tasks
      });

      const completion_rate = employee.avg_progress > 0 
        ? Math.round(employee.avg_progress)
        : employee.total_tasks > 0 
          ? Math.round((employee.completed_tasks / employee.total_tasks) * 100)
          : 0;

      return {
        id: employee.id,
        name: employee.name,
        email: employee.email || this.generateEmail(employee.name),
        total_tasks: employee.total_tasks || 0,
        completed_tasks: employee.completed_tasks || 0,
        pending_tasks: employee.pending_tasks || 0,
        in_progress_tasks: employee.in_progress_tasks || 0,
        overdue_tasks: employee.overdue_tasks || 0,
        completion_rate: completion_rate,
        monthly_progress: this.generateMonthlyProgress(employee)
      };
    });

    console.log('✅ Processed employees:', this.employeesProgress);
    
    // Initially show all employees
    this.filteredEmployees = [...this.employeesProgress];
    this.calculateEmployeeOverviewStats();
  }

  processTasksData(tasks: Task[]) {
    console.log('📋 Processing tasks data:', tasks.length, 'tasks');
    this.tasks = tasks;
    this.filteredTasks = [...tasks];
    
    // After loading tasks, filter by all months to show initial data
    this.filterByMonth();
    this.calculateTaskStats();
  }

  // UPDATED: Fixed filterByMonth method
  filterByMonth() {
    console.log('🔍 Filtering by month:', this.selectedMonth);
    
    if (this.selectedMonth === 'all') {
      console.log('📅 Showing All Months - Calculating from all tasks');
      
      // For "All Months", calculate employee stats from ALL tasks
      this.calculateEmployeeStatsFromTasks(this.tasks);
      this.filteredTasks = [...this.tasks];
    } else {
      const targetMonth = this.getMonthNumber(this.selectedMonth);
      const currentYear = new Date().getFullYear();
      
      console.log(`📅 Filtering for ${this.selectedMonth} (Month ${targetMonth}), Year ${currentYear}`);
      
      // Filter tasks by month
      this.filteredTasks = this.tasks.filter(task => {
        if (!task.due_date) {
          console.warn('Task has no due date:', task.id);
          return false;
        }
        
        try {
          const dueDate = new Date(task.due_date);
          const matchesMonth = dueDate.getMonth() === targetMonth;
          const matchesYear = dueDate.getFullYear() === currentYear;
          
          if (matchesMonth && matchesYear) {
            console.log(`✅ Task ${task.id} matches: ${dueDate.toDateString()}`);
          }
          
          return matchesMonth && matchesYear;
        } catch (error) {
          console.error('Error parsing date for task:', task.id, task.due_date);
          return false;
        }
      });

      console.log(`📋 Filtered ${this.filteredTasks.length} tasks for ${this.selectedMonth}`);
      
      // Calculate employee stats from filtered tasks
      this.calculateEmployeeStatsFromTasks(this.filteredTasks);
    }
    
    // Recalculate all stats
    this.calculateEmployeeOverviewStats();
    this.calculateTaskStats();
    
    console.log('✅ Filter completed. Employees:', this.filteredEmployees.length);
    console.log('📊 Employee data after filter:', this.filteredEmployees);
  }

  // NEW: Helper method to calculate employee stats from tasks
  calculateEmployeeStatsFromTasks(taskList: Task[]) {
    console.log('🧮 Calculating employee stats from', taskList.length, 'tasks');
    
    // Create a map to store employee task counts
    const employeeStatsMap = new Map<number, {
      total: number;
      completed: number;
      pending: number;
      inProgress: number;
      overdue: number;
    }>();
    
    // Initialize all employees with zero counts
    this.employeesProgress.forEach(employee => {
      employeeStatsMap.set(employee.id, {
        total: 0,
        completed: 0,
        pending: 0,
        inProgress: 0,
        overdue: 0
      });
    });
    
    // Count tasks for each employee
    taskList.forEach(task => {
      const stats = employeeStatsMap.get(task.assigned_to);
      if (stats) {
        stats.total++;
        
        // Count by status
        if (task.status === 'completed') {
          stats.completed++;
        } else if (task.status === 'pending') {
          stats.pending++;
        } else if (task.status === 'in_progress') {
          stats.inProgress++;
        }
        
        // Count overdue
        if (task.is_overdue) {
          stats.overdue++;
        }
      } else {
        console.warn(`Employee ${task.assigned_to} not found for task ${task.id}`);
      }
    });
    
    // Update filtered employees with calculated stats
    this.filteredEmployees = this.employeesProgress.map(employee => {
      const stats = employeeStatsMap.get(employee.id) || {
        total: 0,
        completed: 0,
        pending: 0,
        inProgress: 0,
        overdue: 0
      };
      
      // Calculate completion rate
      const completion_rate = stats.total > 0 
        ? Math.round((stats.completed / stats.total) * 100)
        : 0;
      
      console.log(`👤 ${employee.name}: Total=${stats.total}, Completed=${stats.completed}, Rate=${completion_rate}%`);
      
      return {
        ...employee,
        total_tasks: stats.total,
        completed_tasks: stats.completed,
        pending_tasks: stats.pending,
        in_progress_tasks: stats.inProgress,
        overdue_tasks: stats.overdue,
        completion_rate: completion_rate
      };
    });
    
    // If filtering by specific month, only show employees with tasks in that month
    if (this.selectedMonth !== 'all') {
      this.filteredEmployees = this.filteredEmployees.filter(emp => emp.total_tasks > 0);
    }
  }

  calculateTaskStats() {
    const tasksToCalculate = this.selectedMonth === 'all' ? this.tasks : this.filteredTasks;
    
    this.totalTasks = tasksToCalculate.length;
    this.completedTasks = tasksToCalculate.filter(task => task.status === 'completed').length;
    this.inProgressTasks = tasksToCalculate.filter(task => task.status === 'in_progress').length;
    this.pendingTasks = tasksToCalculate.filter(task => task.status === 'pending').length;
    this.overdueTasks = tasksToCalculate.filter(task => task.is_overdue).length;

    console.log('📊 Task Statistics:', {
      total: this.totalTasks,
      completed: this.completedTasks,
      inProgress: this.inProgressTasks,
      pending: this.pendingTasks,
      overdue: this.overdueTasks
    });

    const statusGroups = this.groupTasksByStatus(tasksToCalculate);
    
    this.taskStatusStats = [
      {
        status: 'Pending',
        count: statusGroups.pending,
        percentage: this.getExactPercentage(statusGroups.pending, this.totalTasks),
        color: '#FF6B6B',
        icon: '⏳'
      },
      {
        status: 'In Progress',
        count: statusGroups.inProgress,
        percentage: this.getExactPercentage(statusGroups.inProgress, this.totalTasks),
        color: '#4ECDC4',
        icon: '🔄'
      },
      {
        status: 'Completed',
        count: statusGroups.completed,
        percentage: this.getExactPercentage(statusGroups.completed, this.totalTasks),
        color: '#45B7D1',
        icon: '✅'
      }
    ];

    console.log('📊 Task Status Stats:', this.taskStatusStats);
  }

  groupTasksByStatus(tasks: Task[]) {
    return {
      pending: tasks.filter(task => task.status === 'pending').length,
      inProgress: tasks.filter(task => task.status === 'in_progress').length,
      completed: tasks.filter(task => task.status === 'completed').length
    };
  }

  getMonthNumber(monthName: string): number {
    const months: { [key: string]: number } = {
      'January': 0, 'February': 1, 'March': 2, 'April': 3,
      'May': 4, 'June': 5, 'July': 6, 'August': 7,
      'September': 8, 'October': 9, 'November': 10, 'December': 11
    };
    return months[monthName] || 0;
  }

  generateEmail(name: string): string {
    if (!name) return 'no-email@company.com';
    return `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`;
  }

  generateMonthlyProgress(employee: TaskStats): MonthlyProgress[] {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    const currentYear = new Date().getFullYear();
    
    return months.map((month, index) => {
      const monthlyTotal = Math.max(1, Math.floor(employee.total_tasks / 12));
      const monthlyCompleted = Math.floor(monthlyTotal * (employee.completed_tasks / Math.max(1, employee.total_tasks)));
      const completionRate = Math.round((monthlyCompleted / Math.max(1, monthlyTotal)) * 100);
      
      return {
        month: month,
        year: currentYear,
        total_tasks: monthlyTotal,
        completed_tasks: monthlyCompleted,
        completion_rate: completionRate,
        pending_tasks: monthlyTotal - monthlyCompleted
      };
    });
  }

  calculateEmployeeOverviewStats() {
    this.totalEmployees = this.filteredEmployees.length;
    this.totalAssignedTasks = this.filteredEmployees.reduce((sum, emp) => sum + emp.total_tasks, 0);
    this.totalCompletedTasks = this.filteredEmployees.reduce((sum, emp) => sum + emp.completed_tasks, 0);
    
    if (this.filteredEmployees.length > 0) {
      const totalRate = this.filteredEmployees.reduce((sum, emp) => sum + emp.completion_rate, 0);
      this.avgCompletionRate = Math.round(totalRate / this.filteredEmployees.length);
    } else {
      this.avgCompletionRate = 0;
    }
    
    console.log('📈 Overview Stats:', {
      totalEmployees: this.totalEmployees,
      totalAssignedTasks: this.totalAssignedTasks,
      totalCompletedTasks: this.totalCompletedTasks,
      avgCompletionRate: this.avgCompletionRate
    });
  }

  selectEmployee(employee: EmployeeProgress) {
    this.selectedEmployee = employee;
  }

  getProgressClass(completionRate: number): string {
    if (completionRate >= 80) return 'progress-high';
    if (completionRate >= 60) return 'progress-medium';
    if (completionRate >= 40) return 'progress-low';
    return 'progress-very-low';
  }

  getExactPercentage(count: number, total: number): number {
    return total > 0 ? (count / total) * 100 : 0;
  }

  // Get progress colors based on task status
  getProgressColors(employee: EmployeeProgress): { completed: number, inProgress: number, pending: number } {
    const total = employee.total_tasks || 1;
    return {
      completed: (employee.completed_tasks / total) * 100,
      inProgress: (employee.in_progress_tasks / total) * 100,
      pending: (employee.pending_tasks / total) * 100
    };
  }

  exportToPDF() {
    console.log('Exporting to PDF...');
  }

  refreshData() {
    console.log('🔄 Refreshing data...');
    this.isLoading = true;
    this.selectedMonth = 'all';
    this.loadEmployeeProgress();
    this.loadTasks();
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
}