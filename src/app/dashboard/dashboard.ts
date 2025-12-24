import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  due_date: string;
  assigned_to_name: string;
  time_remaining?: number;
  is_overdue?: boolean;
  is_today?: boolean;
  progress_percent?: number;
}

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  inProgressTasks: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {
  user: any;
  stats: DashboardStats = {
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    inProgressTasks: 0
  };
  recentTasks: Task[] = [];
  allTasks: Task[] = [];
  isLoading = true;

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
    private router: Router
  ) {}

  ngOnInit() {
    this.API_URL = this.getApiUrl();
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!userData || !token) {
      this.router.navigate(['/login']);
      return;
    }

    this.user = JSON.parse(userData);
    this.loadDashboardData();
  }

  loadDashboardData() {
    const token = localStorage.getItem('token');

    this.http.get<Task[]>(`${this.getApiUrl()}/tasks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (tasks) => {
        this.allTasks = tasks;
        this.calculateStats(tasks);
        this.recentTasks = this.getRecentTasks(tasks);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load dashboard data:', err);
        this.isLoading = false;
      }
    });
  }

  calculateStats(tasks: Task[]) {
    const now = new Date().getTime();
    
    const overdueTasks = tasks.filter(task => {
      if (task.status === 'completed') return false;
      const dueDate = new Date(task.due_date).getTime();
      return dueDate < now;
    });

    this.stats = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      overdueTasks: overdueTasks.length,
      inProgressTasks: tasks.filter(t => t.status === 'in_progress').length
    };
  }

  getRecentTasks(tasks: Task[]): Task[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const processedTasks = tasks.map(task => {
      const taskDueDate = new Date(task.due_date);
      taskDueDate.setHours(0, 0, 0, 0);
      
      return this.calculateTaskTime({
        ...task,
        is_today: taskDueDate.getTime() === today.getTime()
      });
    });

    return processedTasks
      .sort((a, b) => {
        if (a.is_today && !b.is_today) return -1;
        if (!a.is_today && b.is_today) return 1;
        
        if (a.is_overdue && !b.is_overdue) return -1;
        if (!a.is_overdue && b.is_overdue) return 1;
        
        const statusOrder = { 'pending': 0, 'in_progress': 1, 'completed': 2, 'overdue': -1 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        
        const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      })
      .slice(0, 5);
  }

  // TASK CATEGORY METHODS
  getTodaysTasks(): Task[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.allTasks
      .filter(task => {
        const taskDueDate = new Date(task.due_date);
        taskDueDate.setHours(0, 0, 0, 0);
        return taskDueDate.getTime() === today.getTime() && task.status !== 'completed';
      })
      .map(task => this.calculateTaskTime(task))
      .sort((a, b) => {
        if (a.is_overdue && !b.is_overdue) return -1;
        if (!a.is_overdue && b.is_overdue) return 1;
        
        const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 3);
  }

  getTodaysTasksCount(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.allTasks.filter(task => {
      const taskDueDate = new Date(task.due_date);
      taskDueDate.setHours(0, 0, 0, 0);
      return taskDueDate.getTime() === today.getTime() && task.status !== 'completed';
    }).length;
  }

  getPendingTasks(): Task[] {
    return this.allTasks
      .filter(task => task.status === 'pending')
      .map(task => this.calculateTaskTime(task))
      .sort((a, b) => {
        const dueDateA = new Date(a.due_date).getTime();
        const dueDateB = new Date(b.due_date).getTime();
        
        if (dueDateA !== dueDateB) {
          return dueDateA - dueDateB;
        }
        
        const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 3);
  }

  getPendingTasksCount(): number {
    return this.allTasks.filter(task => task.status === 'pending').length;
  }

  getOverdueTasks(): Task[] {
    const now = new Date().getTime();
    
    return this.allTasks
      .filter(task => {
        if (task.status === 'completed') return false;
        const dueDate = new Date(task.due_date).getTime();
        return dueDate < now;
      })
      .map(task => this.calculateTaskTime(task))
      .sort((a, b) => {
        const overdueDaysA = this.getOverdueDays(a);
        const overdueDaysB = this.getOverdueDays(b);
        return overdueDaysB - overdueDaysA;
      })
      .slice(0, 3);
  }

  getOverdueTasksCount(): number {
    const now = new Date().getTime();
    return this.allTasks.filter(task => {
      if (task.status === 'completed') return false;
      const dueDate = new Date(task.due_date).getTime();
      return dueDate < now;
    }).length;
  }

  getInProgressTasks(): Task[] {
    return this.allTasks
      .filter(task => task.status === 'in_progress')
      .map(task => ({
        ...task,
        progress_percent: this.getTaskProgress(task)
      }))
      .sort((a, b) => {
        if (b.progress_percent !== a.progress_percent) {
          return b.progress_percent - a.progress_percent;
        }
        
        const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 3);
  }

  getInProgressTasksCount(): number {
    return this.allTasks.filter(task => task.status === 'in_progress').length;
  }

  // TASK ACTIONS
  startTask(taskId: number) {
    const token = localStorage.getItem('token');

    this.http.put(`${this.getApiUrl()}/tasks/${taskId}`,
      { status: 'in_progress' },
      { headers: { 'Authorization': `Bearer ${token}` } }
    ).subscribe({
      next: () => {
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Failed to start task:', err);
      }
    });
  }

  // UTILITY METHODS
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

  getOverdueDays(task: Task): number {
    const dueDate = new Date(task.due_date).getTime();
    const now = new Date().getTime();
    return Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
  }

  getTaskProgress(task: Task): number {
    if (task.progress_percent !== undefined) {
      return task.progress_percent;
    }
    
    switch (task.status) {
      case 'completed': return 100;
      case 'in_progress': return this.calculateProgressBasedOnDueDate(task);
      case 'pending': return 0;
      case 'overdue': return 0;
      default: return 0;
    }
  }

  private calculateProgressBasedOnDueDate(task: Task): number {
    const createdDate = new Date(task.due_date);
    createdDate.setDate(createdDate.getDate() - 7);
    const dueDate = new Date(task.due_date).getTime();
    const now = new Date().getTime();
    const created = createdDate.getTime();
    
    const totalDuration = dueDate - created;
    const elapsed = now - created;
    
    if (totalDuration <= 0) return 100;
    
    const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    return Math.round(progress);
  }

  formatTimeRemaining(milliseconds: number): string {
    if (milliseconds <= 0) return 'Overdue';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return 'Less than 1m';
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

  // NAVIGATION METHODS
  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  viewTodayTasks() {
    this.router.navigate(['/tasks'], { 
      queryParams: { filter: 'today' } 
    });
  }

  viewPendingTasks() {
    this.router.navigate(['/tasks'], { 
      queryParams: { filter: 'pending' } 
    });
  }

  viewOverdueTasks() {
    this.router.navigate(['/tasks'], { 
      queryParams: { filter: 'overdue' } 
    });
  }

  viewInProgressTasks() {
    this.router.navigate(['/tasks'], { 
      queryParams: { filter: 'in_progress' } 
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