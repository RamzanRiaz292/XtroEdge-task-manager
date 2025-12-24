import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface EmployeeStats {
  employee: Employee;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  tasksByPeriod: {
    lifetime: number;
    today: number;
    yesterday: number;
    thisWeek: number;
    thisMonth: number;
  };
  recentTasks: any[];
}

@Component({
  selector: 'app-employee-analytics',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './employee-analytics.html',
  styleUrl: './employee-analytics.scss'
})
export class EmployeeAnalyticsComponent implements OnInit {
  employees: Employee[] = [];
  employeeStats: EmployeeStats[] = [];
  selectedEmployee: EmployeeStats | null = null;
  isLoading: boolean = false;
  user: any;

  // Overview statistics properties
  totalEmployees: number = 0;
  avgCompletionRate: number = 0;
  totalTasksAssigned: number = 0;
  totalOverdueTasks: number = 0;

  private API_URL = 'http://localhost:3000/api';

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
  ) {}

  ngOnInit() {
    this.API_URL = this.getApiUrl();
    const userData = localStorage.getItem('user');
    if (!userData) {
      this.router.navigate(['/login']);
      return;
    }

    this.user = JSON.parse(userData);
    this.loadEmployeesWithStats();
  }

  loadEmployeesWithStats() {
    this.isLoading = true;
    const token = localStorage.getItem('token');

    // First load all employees
    this.http.get<Employee[]>(`${this.getApiUrl()}/employees`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (employees) => {
        // console.log('Employees loaded:', employees);
        this.employees = employees;
        this.loadEmployeeStats();
      },
      error: (err) => {
        console.error('Failed to load employees:', err);
        this.isLoading = false;
      }
    });
  }

  loadEmployeeStats() {
    const token = localStorage.getItem('token');

    // Load all tasks to calculate statistics
    this.http.get<any[]>(`${this.getApiUrl()}/tasks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (tasks) => {
        // console.log('Tasks loaded for stats:', tasks);
        this.calculateEmployeeStats(tasks);
        this.calculateOverviewStats();
        this.isLoading = false;
        // console.log('Employee stats calculated:', this.employeeStats);
      },
      error: (err) => {
        console.error('Failed to load tasks:', err);
        this.isLoading = false;
      }
    });
  }

  calculateEmployeeStats(tasks: any[]) {
    // console.log('Calculating employee stats from', tasks.length, 'tasks');
    
    this.employeeStats = this.employees.map(employee => {
      const employeeTasks = tasks.filter(task => task.assigned_to === employee.id);
      // console.log(`Employee ${employee.name} has ${employeeTasks.length} tasks`);
      
      const now = new Date();
      
      // Calculate dates for different periods
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());
      
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const stats: EmployeeStats = {
        employee: employee,
        totalTasks: employeeTasks.length,
        completedTasks: employeeTasks.filter(t => t.status === 'completed').length,
        pendingTasks: employeeTasks.filter(t => t.status === 'pending').length,
        inProgressTasks: employeeTasks.filter(t => t.status === 'in_progress').length,
        overdueTasks: employeeTasks.filter(t => {
          const dueDate = new Date(t.due_date);
          return dueDate < now && t.status !== 'completed';
        }).length,
        completionRate: employeeTasks.length > 0 ? 
          (employeeTasks.filter(t => t.status === 'completed').length / employeeTasks.length) * 100 : 0,
        tasksByPeriod: {
          lifetime: employeeTasks.length,
          today: employeeTasks.filter(t => {
            const taskDate = new Date(t.created_at);
            return taskDate >= today;
          }).length,
          yesterday: employeeTasks.filter(t => {
            const taskDate = new Date(t.created_at);
            return taskDate >= yesterday && taskDate < today;
          }).length,
          thisWeek: employeeTasks.filter(t => {
            const taskDate = new Date(t.created_at);
            return taskDate >= thisWeekStart;
          }).length,
          thisMonth: employeeTasks.filter(t => {
            const taskDate = new Date(t.created_at);
            return taskDate >= thisMonthStart;
          }).length
        },
        recentTasks: employeeTasks
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
      };

      // console.log(`Stats for ${employee.name}:`, stats);
      return stats;
    });
  }

  calculateOverviewStats() {
    this.totalEmployees = this.employees.length;
    
    // Calculate average completion rate
    if (this.employeeStats.length > 0) {
      const totalCompletionRate = this.employeeStats.reduce((sum, stat) => sum + stat.completionRate, 0);
      this.avgCompletionRate = Number((totalCompletionRate / this.employeeStats.length).toFixed(1));
    } else {
      this.avgCompletionRate = 0;
    }
    
    // Calculate total tasks assigned
    this.totalTasksAssigned = this.employeeStats.reduce((sum, stat) => sum + stat.totalTasks, 0);
    
    // Calculate total overdue tasks
    this.totalOverdueTasks = this.employeeStats.reduce((sum, stat) => sum + stat.overdueTasks, 0);

    // console.log('Overview stats:', {
    //   totalEmployees: this.totalEmployees,
    //   avgCompletionRate: this.avgCompletionRate,
    //   totalTasksAssigned: this.totalTasksAssigned,
    //   totalOverdueTasks: this.totalOverdueTasks
    // });
  }

  viewEmployeeDetails(employeeStat: EmployeeStats, event?: Event) {
    if (event) {
      event.stopPropagation(); // Prevent event bubbling
    }
    // console.log('Opening employee details:', employeeStat);
    this.selectedEmployee = employeeStat;
  }

  closeEmployeeDetails(event?: Event) {
    if (event) {
      event.stopPropagation(); // Prevent event bubbling
    }
    // console.log('Closing employee details');
    this.selectedEmployee = null;
  }

  onModalClick(event: Event) {
    event.stopPropagation(); // Prevent closing when clicking inside modal
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

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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