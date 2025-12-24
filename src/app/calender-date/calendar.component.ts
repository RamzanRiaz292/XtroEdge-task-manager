import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface CalendarEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  priority: string;
  status: string;
  assigned_to: number;
  assigned_to_name?: string;
  description?: string;
  progress_percent?: number;
  estimated_hours?: number;
  time_spent?: number;
  due_date?: string;
  assigned_by_name?: string;
}

interface Holiday {
  id?: number;
  date: string;
  title: string;
  type: 'holiday' | 'extra_duty';
  description?: string;
  created_by_name?: string;
}

interface TaskHistory {
  employee_id: number;
  employee_name: string;
  total_tasks: number;
  tasks: CalendarEvent[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './calender.html',
  styleUrl: './calender.scss'
})
export class CalendarComponent implements OnInit {
  events: CalendarEvent[] = [];
  holidays: Holiday[] = [];
  currentDate: Date = new Date();
  days: Date[] = [];
  user: any;
  
  // Modal properties
  showHolidayModal: boolean = false;
  showTaskHistoryModal: boolean = false;
  selectedDate: Date | null = null;
  taskHistory: TaskHistory[] = [];
  
  // Holiday form
  holidayForm = {
    title: '',
    description: '',
    type: 'holiday' as 'holiday' | 'extra_duty'
  };

  private API_URL = 'https://xtro-edge-task-manager-backend.vercel.app';

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
    this.generateCalendar();
    this.loadEvents();
    this.loadHolidays();
  }

  generateCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    this.days = [];
    
    // Add previous month's days
    const startingDayOfWeek = firstDay.getDay();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      this.days.push(date);
    }
    
    // Add current month's days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      this.days.push(new Date(year, month, i));
    }
    
    // Add next month's days
    const totalCells = 42; // 6 weeks
    const remainingDays = totalCells - this.days.length;
    for (let i = 1; i <= remainingDays; i++) {
      this.days.push(new Date(year, month + 1, i));
    }
  }

  loadEvents() {
    const token = localStorage.getItem('token');

    this.http.get<CalendarEvent[]>(`${this.getApiUrl()}/calendar/events`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (events) => {
        this.events = events;
        // console.log('Events loaded:', events.length);
        // console.log('Sample event dates:', events.slice(0, 3).map(e => ({ 
        //   title: e.title, 
        //   start: e.start,
        //   parsed: new Date(e.start).toDateString()
        // })));
      },
      error: (err) => {
        console.error('Failed to load events:', err);
      }
    });
  }

  loadHolidays() {
    const token = localStorage.getItem('token');

    this.http.get<Holiday[]>(`${this.getApiUrl()}/holidays`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (holidays) => {
        this.holidays = holidays;
        // console.log('Holidays loaded:', holidays.length);
        // console.log('Sample holidays:', holidays.slice(0, 3));
      },
      error: (err) => {
        console.error('Failed to load holidays:', err);
      }
    });
  }

  // FIXED: Proper date comparison without timezone issues
  getEventsForDate(date: Date): CalendarEvent[] {
    const dateString = this.formatDateForComparison(date);
    // console.log(`Looking for events on: ${dateString}`);
    
    const eventsForDate = this.events.filter(event => {
      const eventDateString = this.formatDateForComparison(new Date(event.start));
      const matches = eventDateString === dateString;
      
      if (matches) {
        // console.log(`Found event: ${event.title} on ${eventDateString}`);
      }
      
      return matches;
    });
    
    // console.log(`Found ${eventsForDate.length} events for ${dateString}`);
    return eventsForDate;
  }

  // FIXED: Proper holiday detection with better logging
  getHolidayForDate(date: Date): Holiday | null {
    const dateString = this.formatDateForComparison(date);
    const holiday = this.holidays.find(h => {
      const holidayDateString = this.formatDateForComparison(new Date(h.date));
      return holidayDateString === dateString;
    });
    
    if (holiday) {
      // console.log(`Found holiday: ${holiday.title} on ${dateString}`);
    }
    
    return holiday || null;
  }

  // FIXED: Utility function to format dates consistently
  private formatDateForComparison(date: Date): string {
    // Use YYYY-MM-DD format for consistent comparison
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isSunday(date: Date): boolean {
    return date.getDay() === 0;
  }

  previousMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    this.generateCalendar();
    this.loadEvents();
    this.loadHolidays();
  }

  nextMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    this.generateCalendar();
    this.loadEvents();
    this.loadHolidays();
  }

  goToToday() {
    this.currentDate = new Date();
    this.generateCalendar();
    this.loadEvents();
    this.loadHolidays();
  }

  getMonthYear(): string {
    return this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.currentDate.getMonth();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
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

  // FIXED: Holiday Modal with better initialization
  openHolidayModal(date: Date) {
    // console.log('Opening holiday modal for date:', date);
    this.selectedDate = date;
    const isSunday = this.isSunday(date);
    
    // Check if holiday already exists for this date
    const existingHoliday = this.getHolidayForDate(date);
    
    if (existingHoliday) {
      // Edit existing holiday
      this.holidayForm = {
        title: existingHoliday.title,
        description: existingHoliday.description || '',
        type: existingHoliday.type
      };
      // console.log('Editing existing holiday:', existingHoliday);
    } else {
      // New holiday - prefill for Sunday
      this.holidayForm = {
        title: isSunday ? 'Sunday - Weekly Holiday' : '',
        description: isSunday ? 'Regular weekly holiday' : '',
        type: 'holiday'
      };
      // console.log('Creating new holiday for date:', date);
    }
    
    this.showTaskHistoryModal = false;
    setTimeout(() => {
      this.showHolidayModal = true;
    }, 10);
  }

  // FIXED: Save holiday with immediate frontend update
  saveHoliday() {
    if (!this.selectedDate || !this.holidayForm.title) {
      alert('Please fill all required fields');
      return;
    }

    const token = localStorage.getItem('token');
    const dateString = this.formatDateForComparison(this.selectedDate);
    const holidayData = {
      ...this.holidayForm,
      date: dateString
    };

    // console.log('Saving holiday:', holidayData);

    // Check if holiday already exists for this date
    const existingHoliday = this.getHolidayForDate(this.selectedDate);

    const request = existingHoliday && existingHoliday.id ?
      this.http.put<any>(`${this.getApiUrl()}/holidays/${existingHoliday.id}`, holidayData, {
        headers: { 'Authorization': `Bearer ${token}` }
      }) :
      this.http.post<any>(`${this.getApiUrl()}/holidays`, holidayData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

    request.subscribe({
      next: (response) => {
        // console.log('Holiday saved successfully:', response);
        
        const savedHoliday = response.holiday || response;
        
        // Update local holidays array immediately
        if (existingHoliday && existingHoliday.id) {
          // Update existing holiday
          const index = this.holidays.findIndex(h => h.id === existingHoliday.id);
          if (index !== -1) {
            this.holidays[index] = { ...savedHoliday };
          }
        } else {
          // Add new holiday
          this.holidays.push({ ...savedHoliday });
        }
        
        // console.log('Updated holidays array:', this.holidays);
        
        this.closeHolidayModal();
        alert(`${holidayData.type === 'holiday' ? 'Holiday' : 'Extra Duty'} ${existingHoliday ? 'updated' : 'added'} successfully!`);
      },
      error: (err) => {
        console.error('Failed to save holiday:', err);
        const errorMessage = err.error?.error || 'Failed to save holiday';
        
        // Even if API fails, add to local array for immediate display
        if (!existingHoliday) {
          const mockHoliday: Holiday = {
            id: Date.now(), // Temporary ID
            date: dateString,
            title: holidayData.title,
            type: holidayData.type,
            description: holidayData.description,
            created_by_name: this.user.name
          };
          this.holidays.push(mockHoliday);
          console.log('Added holiday locally due to API failure:', mockHoliday);
        }
        
        alert(errorMessage);
      }
    });
  }

  closeHolidayModal() {
    this.showHolidayModal = false;
    this.selectedDate = null;
    this.holidayForm = { title: '', description: '', type: 'holiday' };
  }

  // FIXED: Task History with same day filtering
  viewTaskHistory(date: Date) {
    // console.log('Opening task history for date:', date);
    this.selectedDate = date;
    const dateString = this.formatDateForComparison(date);
    
    this.showHolidayModal = false;
    
    const token = localStorage.getItem('token');
    this.http.get<TaskHistory[]>(`${this.getApiUrl()}/tasks/history?date=${dateString}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (history) => {
        // console.log('Task history loaded:', history);
        this.taskHistory = history;
        setTimeout(() => {
          this.showTaskHistoryModal = true;
        }, 10);
      },
      error: (err) => {
        console.error('Failed to load task history:', err);
        // Use events for the selected date as fallback
        this.createTaskHistoryFromEvents(date);
        setTimeout(() => {
          this.showTaskHistoryModal = true;
        }, 10);
      }
    });
  }

  // FIXED: Create task history from events for the specific date
  createTaskHistoryFromEvents(date: Date) {
    const dateEvents = this.getEventsForDate(date);
    // console.log('Creating history from events for date:', date, 'Found:', dateEvents.length);
    
    // Group events by assigned_to
    const eventsByEmployee = new Map<number, CalendarEvent[]>();
    
    dateEvents.forEach(event => {
      if (!eventsByEmployee.has(event.assigned_to)) {
        eventsByEmployee.set(event.assigned_to, []);
      }
      eventsByEmployee.get(event.assigned_to)!.push(event);
    });
    
    this.taskHistory = Array.from(eventsByEmployee.entries()).map(([employeeId, tasks]) => ({
      employee_id: employeeId,
      employee_name: tasks[0]?.assigned_to_name || `Employee ${employeeId}`,
      total_tasks: tasks.length,
      tasks: tasks
    }));
    
    // console.log('Created task history from events:', this.taskHistory);
  }

  closeTaskHistoryModal() {
    this.showTaskHistoryModal = false;
    this.selectedDate = null;
    this.taskHistory = [];
  }

  getTotalTasksForDate(date: Date): number {
    return this.getEventsForDate(date).length;
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

  // FIXED: Month-wise task counting
  get currentMonthEvents(): CalendarEvent[] {
    const currentMonth = this.currentDate.getMonth();
    const currentYear = this.currentDate.getFullYear();
    
    return this.events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.getMonth() === currentMonth && 
             eventDate.getFullYear() === currentYear;
    });
  }

  // FIXED: Statistics for current month only
  get totalTasksCount(): number {
    return this.currentMonthEvents.length;
  }

  get completedTasksCount(): number {
    return this.currentMonthEvents.filter(e => e.status === 'completed').length;
  }

  get pendingTasksCount(): number {
    return this.currentMonthEvents.filter(e => 
      e.status === 'pending' || e.status === 'in_progress'
    ).length;
  }

  // Helper methods
  getTaskProgress(task: any): number {
    return task.progress_percent || task['progress_percent'] || 0;
  }

  getEstimatedHours(task: any): number {
    return task.estimated_hours || task['estimated_hours'] || 1;
  }

  getTimeSpent(task: any): number {
    return task.time_spent || task['time_spent'] || 0;
  }

  hasDescription(task: any): boolean {
    return !!(task.description || task['description']);
  }

  getDescription(task: any): string {
    return task.description || task['description'] || '';
  }
}