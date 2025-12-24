import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { io, Socket } from 'socket.io-client';

interface Task {
  id: number;
  title: string;
  description: string;
  assigned_to: number;
  assigned_to_name: string;
  assigned_by_name: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  due_date: string;
  estimated_hours: number;
  time_spent: number;
  completed_at: string | null;
  time_remaining?: number;
  is_overdue?: boolean;
  progress_percent: number;
  created_at: string;
  local_due_date?: string;
  local_created_at?: string;
  project_id?: number;
  project_name?: string;
  project_client?: string;
  selected?: boolean;
}

interface Project {
  id: number;
  name: string;
  client_name: string;
  description?: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  start_date?: string;
  end_date?: string;
  budget?: number;
  priority: 'low' | 'medium' | 'high';
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  employee_count?: number;
  task_count?: number;
  completed_tasks?: number;
  employees?: ProjectEmployee[];
  tasks?: Task[];
}

interface ProjectEmployee {
  id: number;
  project_id: number;
  employee_id: number;
  employee_name: string;
  employee_email: string;
  role: string;
  assigned_at: string;
  total_tasks?: number;
  completed_tasks?: number;
  in_progress_tasks?: number;
}

interface Employee {
  id: number;
  name: string;
  email: string;
}

interface EmployeeStats {
  employee_id: number;
  employee_name: string;
  total_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
}

interface Chat {
  id: number;
  type: string;
  name?: string;
  other_user_id: number;
  other_user_name: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  created_at: string;
  display_time?: string;
  relative_time?: string;
}

interface Message {
  id: number;
  chat_id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  message_type: string;
  task_id?: number;
  task_title?: string;
  created_at: string;
  is_read: boolean;
  display_time?: string;
  relative_time?: string;
  local_created_at?: string;
}

interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  comment: string;
  parent_comment_id?: number;
  created_at: string;
  display_time?: string;
  relative_time?: string;
}

interface Notification {
  sender_name: any;
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  related_id?: number;
  is_read: boolean;
  created_at: string;
  sound?: boolean;
  show_popup?: boolean;
  display_time?: string;
  relative_time?: string;
}

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './task-manager.html',
  styleUrl: './task-manager.scss'
})
export class TaskManagerComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  employees: Employee[] = [];
  user: any;
  selectedTask: Task | null = null;
  selectedTaskForDetails: Task | null = null;

  // Project Management properties
  projects: Project[] = [];
  selectedProject: Project | null = null;
  showProjectModal = false;
  showProjectDetails = false;
  showCreateTaskForProject = false;
  filterProject = 'all';

  // New project form
  newProject = {
    name: '',
    client_name: '',
    description: '',
    status: 'active',
    start_date: '',
    end_date: '',
    budget: null as number | null,
    priority: 'medium',
    employee_ids: [] as number[]
  };

  // Project employee assignment
  showAssignEmployees = false;
  projectEmployeesToAssign: number[] = [];

  // Task Creation Modal
  showCreateTaskModal = false;
  newTask = {
    title: '',
    description: '',
    assigned_to: null as number | null,
    assigned_employees: [] as number[],
    priority: 'medium',
    due_date: '',
    estimated_hours: 1,
    project_id: null as number | null,
    project_name: '',
    client_name: ''
  };

  // Task Templates
  taskTemplates = [
    { name: 'Bug Fix', priority: 'high', estimated_hours: 4, description: 'Fix reported bug in the application' },
    { name: 'Feature Development', priority: 'medium', estimated_hours: 16, description: 'Develop new feature as per requirements' },
    { name: 'Code Review', priority: 'medium', estimated_hours: 2, description: 'Review code changes and provide feedback' },
    { name: 'Documentation', priority: 'low', estimated_hours: 4, description: 'Create or update documentation' },
    { name: 'Testing', priority: 'medium', estimated_hours: 8, description: 'Write and execute test cases' }
  ];

  // Bulk task selection
  selectedTasks: number[] = [];
  showBulkActions = false;

  // Chat properties
  isChatOpen = false;
  chats: Chat[] = [];
  selectedChat: Chat | null = null;
  messages: Message[] = [];
  newMessage = '';
  isTyping = false;
  typingUsers: string[] = [];

  // Group chat creation
  showGroupCreation = false;
  groupName = '';
  selectedEmployees: number[] = [];

  // Comments properties
  taskComments: TaskComment[] = [];
  newComment = '';

  // Notifications properties
  notifications: Notification[] = [];
  unreadNotifications = 0;
  showNotifications = false;

  // Progress update properties
  progressUpdate = {
    progress_percent: 0,
    notes: '',
    time_spent: 0
  };

  // Filter properties
  filterStatus = 'all';
  filterEmployee = 'all';
  filterTimeRange = 'lifetime';

  // Statistics properties
  totalTasks: number = 0;
  inProgressTasks: number = 0;
  overdueTasks: number = 0;
  completedTasks: number = 0;
  pendingTasks: number = 0;

  // Employee statistics
  employeeStats: EmployeeStats[] = [];
  selectedEmployeeStats: EmployeeStats | null = null;

  // WebSocket
  private socket: Socket | null = null;
  private timers: any[] = [];

  // API URLs
  private readonly API_URL = this.getApiUrl();
  private readonly WS_URL = this.getWsUrl();

  // Alert control
  private hasShownInitialAlert = false;

  // Chat auto-refresh
  private chatRefreshTimer: any = null;

  // Track last notification time
  private lastNotificationCheck: Date = new Date();

  // Chat position
  chatPosition: 'left' | 'right' = 'right';

  // Track scroll position
  private scrollPosition = 0;
  private isUserScrolling = false;

  // Delete notification state
  showDeleteToast = false;
  deleteToastMessage = '';

  // View references
  @ViewChild('messageInput') messageInput!: ElementRef;

  // ✅ FIX: Track notification IDs to prevent duplicates
  private notificationIds = new Set<number>();

  // ✅ FIX: Track last message to prevent blink
  private lastMessagesHash: string = '';

  // ✅ FIX: Track sent messages to prevent duplicates
  private sentMessageIds = new Set<number>();

  // ✅ FIX: Employee list toggle
  showEmployeesList = false;

  // ✅ FIX: Message duplicate tracker
  private sentMessageTracker = new Set<string>();

  // ✅ FIX: Prevent multiple message sending
  private isSendingMessage = false;

  // ✅ FIX: Track comment notifications to prevent duplicates
  private commentNotificationTracker = new Set<string>();

  // ✅ FIX: Track processed comment notifications to prevent duplicates
  private processedCommentNotifications = new Set<string>();

  // ✅ FIX: Comment throttling properties
  private isAddingComment = false;
  private lastCommentTime = 0;
  private readonly COMMENT_THROTTLE_TIME = 1000;
  private pendingComment: { taskId: number, comment: string } | null = null;

  // ✅ FIX: Chat time update interval
  private chatTimeUpdateInterval: any = null;

  // ✅ FIX: Notification time update interval
  private notificationTimeUpdateInterval: any = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  // ✅ FIX: Dynamic API URL detection
  private getApiUrl(): string {
    const currentUrl = window.location.href;
    if (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
      return 'http://localhost:3000/api';
    } else {
      // Production URL - adjust according to your backend
      return 'https://xtro-edge-task-manager-backend.vercel.app/api';
    }
  }

  // ✅ FIX: Dynamic WebSocket URL detection with proper protocol
  private getWsUrl(): string {
    const currentUrl = window.location.href;
    if (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
      return 'http://localhost:3000';
    } else {
      // Production URL - use wss:// for HTTPS and ws:// for HTTP
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${wsProtocol}//${host}`;
    }
  }

  ngOnInit() {
    const userData = localStorage.getItem('user');
    if (!userData) {
      this.router.navigate(['/login']);
      return;
    }

    this.user = JSON.parse(userData);

    // Ensure user has proper ID
    if (!this.user.id && this.user.userId) {
      this.user.id = this.user.userId;
    }

    console.log('👤 User loaded:', this.user);
    console.log('🔗 API URL:', this.API_URL);
    console.log('🔌 WebSocket URL:', this.WS_URL);

    // ✅ FIX: Load data in correct order
    this.loadEmployees();
    this.loadTasks();
    this.loadNotifications();
    if (this.isManager()) {
      this.loadProjects();
    }

    // Initialize WebSocket connection
    this.initializeWebSocket();

    // Start auto-refresh for notifications
    this.startAutoRefresh();

    // Request notification permission
    this.requestNotificationPermission();

    // Set chat position based on user preference
    this.setChatPosition();

    // Start notification time updater
    this.startNotificationTimeUpdate();

    // ✅ FIX: Start chat time updater
    this.startChatTimeUpdate();
  }

  ngOnDestroy() {
    this.timers.forEach(timer => clearInterval(timer));
    this.stopChatAutoRefresh();
    this.stopChatTimeUpdate();
    this.stopNotificationTimeUpdate();
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // ✅ FIX: Set chat position
  private setChatPosition() {
    const savedPosition = localStorage.getItem('chatPosition');
    this.chatPosition = (savedPosition as 'left' | 'right') || 'right';
  }

  // ✅ FIX: Toggle chat position
  toggleChatPosition() {
    this.chatPosition = this.chatPosition === 'right' ? 'left' : 'right';
    localStorage.setItem('chatPosition', this.chatPosition);
    this.cdr.detectChanges();
  }

  // ✅ FIX: Toggle employees list
  toggleEmployeesList() {
    this.showEmployeesList = !this.showEmployeesList;
    if (this.showEmployeesList) {
      this.loadAllEmployees();
    }
    this.cdr.detectChanges();
  }

  // ==================== CHAT HELPER METHODS ====================

  getTotalUnreadChats(): number {
    if (!this.chats || this.chats.length === 0) {
      return 0;
    }

    const total = this.chats.reduce((total, chat) => {
      const unreadCount = Number(chat.unread_count) || 0;
      return total + unreadCount;
    }, 0);

    return total;
  }

  isChatSelected(chat: Chat): boolean {
    return this.selectedChat !== null && this.selectedChat.id === chat.id;
  }

  onTyping() {
    if (this.selectedChat) {
      this.socket?.emit('typing', {
        chatId: this.selectedChat.id,
        isTyping: true,
        userName: this.user.name
      });

      setTimeout(() => {
        this.socket?.emit('typing', {
          chatId: this.selectedChat?.id,
          isTyping: false,
          userName: this.user.name
        });
      }, 2000);
    }
  }

  // ✅ FIX: Handle Enter key for sending messages
  @HostListener('document:keydown.enter', ['$event'])
  handleEnterKey(event: any) {
    if (this.isChatOpen && this.selectedChat && this.newMessage.trim()) {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName === 'INPUT' &&
        (activeElement as HTMLInputElement).className.includes('message-input')) {

        if (event.preventDefault) {
          event.preventDefault();
        }

        this.sendMessage();
      }
    }
  }

  // ==================== DESKTOP NOTIFICATIONS ====================

  private requestNotificationPermission() {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }

  private showDesktopNotification(notification: Notification) {
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      const options: NotificationOptions = {
        body: notification.message,
        tag: notification.id.toString(),
        requireInteraction: true,
        silent: !notification.sound
      };

      const desktopNotification = new Notification(notification.title, options);

      desktopNotification.onclick = () => {
        window.focus();
        this.markNotificationAsRead(notification);
        desktopNotification.close();
      };

      setTimeout(() => {
        desktopNotification.close();
      }, 10000);
    }
  }

  private playNotificationSound() {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

    } catch (e) {
      console.log('Audio play failed, using fallback:', e);
      this.playFallbackSound();
    }
  }

  private playFallbackSound() {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      gainNode.gain.value = 0.3;

      oscillator.start();
      setTimeout(() => oscillator.stop(), 100);

    } catch (err) {
      console.log('Fallback sound also failed:', err);
    }
  }

  // ==================== WEB SOCKET INTEGRATION ====================
  
  // ✅ FIX: NEW - Handle chat notifications with sender info
  private handleChatNotification(notification: Notification) {
    console.log('💬 Chat notification received:', notification);

    // Update chat list if open
    if (this.isChatOpen) {
      this.loadChats();

      // If this notification is for the currently selected chat, load messages
      if (this.selectedChat && this.selectedChat.id === notification.related_id) {
        this.loadMessages(this.selectedChat.id);
      }
    }

    // Update chat badge
    this.updateChatBadge();
  }

  // ✅ FIX: UPDATED - WebSocket handler for new notifications
  private initializeWebSocket() {
    console.log('🔌 Connecting to WebSocket:', this.WS_URL);

    this.socket = io(this.WS_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');

      this.socket?.emit('authenticate', {
        userId: this.getUserId(),
        name: this.user.name,
        role: this.user.role
      });
    });

    // ✅ FIX: Handle new comment notifications - SINGLE NOTIFICATION ONLY
    this.socket.on('new_comment_notification', (data: any) => {
      // console.log('💭 New comment notification from backend:', data);
      this.handleNewCommentNotification(data);
    });

    // ✅ FIX: IMPROVED - Handle all notifications including chat
    this.socket.on('new_notification', (notification: Notification) => {
      console.log('🔔 New real-time notification:', notification);

      if (this.notificationIds.has(notification.id)) {
        console.log('🔄 Skipping duplicate notification:', notification.id);
        return;
      }

      this.notificationIds.add(notification.id);

      // ✅ FIX: CORRECTED - Use proper time formatting for notifications
      const formattedNotification = {
        ...notification,
        created_at: this.ensureValidDate(notification.created_at),
        display_time: notification.relative_time || this.formatDisplayTime(this.ensureValidDate(notification.created_at))
      };

      // ✅ FIX: Add to beginning for top position
      this.notifications.unshift(formattedNotification);
      this.updateUnreadCount();

      // ✅ FIX: Handle chat notifications specifically
      if (notification.type === 'new_message') {
        this.handleChatNotification(formattedNotification);
      }

      const notificationTime = new Date(notification.created_at);
      if (notificationTime > this.lastNotificationCheck) {
        if (notification.show_popup) {
          this.showDesktopNotification(formattedNotification);
        }

        if (notification.sound) {
          this.playNotificationSound();
        }
      }

      this.cdr.detectChanges();
    });

    // ✅ FIX: IMPROVED - Handle new messages with better sender info and CORRECT time
    this.socket.on('new_message', (message: Message) => {
      console.log('💬 New real-time message:', message);

      if (this.sentMessageIds.has(message.id)) {
        console.log('🔄 Skipping duplicate message (already sent):', message.id);
        this.sentMessageIds.delete(message.id);
        return;
      }

      const messageHash = this.createMessageHash(message);
      if (messageHash === this.lastMessagesHash) {
        return;
      }
      this.lastMessagesHash = messageHash;

      // ✅ FIX: CORRECTED - Use proper time formatting for messages
      const formattedMessage = {
        ...message,
        created_at: this.ensureValidDate(message.created_at),
        display_time: message.relative_time || this.formatDisplayTime(this.ensureValidDate(message.created_at))
      };

      if (this.selectedChat && this.selectedChat.id === message.chat_id) {
        this.saveScrollPosition();

        const messageExists = this.messages.some(msg => msg.id === message.id);
        if (!messageExists) {
          this.messages.push(formattedMessage);
        }

        this.scrollToBottomWithCheck();

        if (message.sender_id !== this.user.id) {
          this.markChatAsRead(message.chat_id);
        }
      }

      this.updateChatListWithNewMessage(message);

      this.updateChatBadge();

      this.cdr.detectChanges();
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });
  }

  // ✅ FIX: Create hash for messages to prevent duplicates
  private createMessageHash(message: Message): string {
    return `${message.id}_${message.chat_id}_${message.sender_id}_${message.content}_${message.created_at}`;
  }

  // ✅ FIX: FIXED - Improved comment notification handling to prevent duplicates
  private handleNewCommentNotification(data: any) {
    const notificationKey = `comment_${data.task_id}_${data.commenter_id}_${data.comment_id || Date.now()}`;

    if (this.processedCommentNotifications.has(notificationKey)) {
      console.log('🔄 Skipping duplicate comment notification:', notificationKey);
      return;
    }

    this.processedCommentNotifications.add(notificationKey);

    setTimeout(() => {
      this.processedCommentNotifications.delete(notificationKey);
    }, 60000);

    const isMyComment = data.commenter_id === this.user.id;

    if (isMyComment) {
      console.log('🔕 Skipping own comment notification');
      return;
    }

    const isMyTask = data.task_assigned_to === this.user.id;

    const shouldShowNotification = isMyTask;

    if (!shouldShowNotification) {
      console.log('🔕 Skipping irrelevant comment notification - task not assigned to user');
      return;
    }

    // ✅ FIX: Create SINGLE notification that appears at TOP
    const notification: Notification = {
      id: Date.now() + Math.random(),
      user_id: this.user.id,
      type: 'comment',
      title: 'New Comment',
      message: `${data.commenter_name} commented on your task: ${data.task_title}`,
      related_id: data.task_id,
      is_read: false,
      created_at: new Date().toISOString(),
      // ✅ FIX: CORRECTED - Use proper time formatting
      display_time: data.relative_time || this.formatDisplayTime(new Date().toISOString()),
      sound: true,
      show_popup: true,
      sender_name: data.commenter_name
    };

    if (!this.notificationIds.has(notification.id)) {
      this.notificationIds.add(notification.id);
      // ✅ FIX: Add to BEGINNING of array for top position
      this.notifications.unshift(notification);
      this.updateUnreadCount();

      if (notification.show_popup) {
        this.showDesktopNotification(notification);
      }

      if (notification.sound) {
        this.playNotificationSound();
      }

      this.cdr.detectChanges();
    }
  }

  // ✅ FIX: CORRECTED - Single consistent time formatting method for display
  private formatDisplayTime(dateString: string): string {
    try {
      const date = new Date(dateString);

      if (isNaN(date.getTime())) {
        console.warn('⚠️ Invalid date in formatDisplayTime:', dateString);
        return 'Just now';
      }

      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) {
        return 'Just now';
      }

      if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes}m ago`;
      }

      if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours}h ago`;
      }

      if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days}d ago`;
      }

      // For older dates, show actual date
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

    } catch (error) {
      console.error('❌ Error formatting display time:', error, 'Input:', dateString);
      return 'Just now';
    }
  }

  // ✅ FIX: UPDATED - Ensure valid date format
  private ensureValidDate(dateString: string): string {
    try {
      if (!dateString) {
        return new Date().toISOString();
      }

      let date: Date;

      if (dateString.includes('T') && dateString.includes('Z')) {
        date = new Date(dateString);
      } else if (dateString.includes(' GMT')) {
        const cleanDate = dateString.replace(' GMT', '');
        date = new Date(cleanDate);
      } else if (dateString.includes('+')) {
        date = new Date(dateString);
      } else {
        // Assume it's already in local timezone
        date = new Date(dateString);
      }

      if (isNaN(date.getTime())) {
        console.warn('⚠️ Invalid date detected, using current time:', dateString);
        return new Date().toISOString();
      }

      return date.toISOString();
    } catch (error) {
      console.error('❌ Error ensuring valid date:', error, 'Input:', dateString);
      return new Date().toISOString();
    }
  }

  // ✅ FIX: CORRECTED - Notification time updater
  private startNotificationTimeUpdate() {
    this.stopNotificationTimeUpdate();

    this.notificationTimeUpdateInterval = setInterval(() => {
      this.notifications = this.notifications.map(notification => ({
        ...notification,
        display_time: notification.relative_time || this.formatDisplayTime(this.ensureValidDate(notification.created_at))
      }));
      this.cdr.detectChanges();
    }, 30000);
  }

  // ✅ FIX: Stop notification time updater
  private stopNotificationTimeUpdate() {
    if (this.notificationTimeUpdateInterval) {
      clearInterval(this.notificationTimeUpdateInterval);
      this.notificationTimeUpdateInterval = null;
    }
  }

  // ✅ FIX: CORRECTED - Chat time updater with proper time formatting
  private startChatTimeUpdate() {
    this.stopChatTimeUpdate();

    this.chatTimeUpdateInterval = setInterval(() => {
      // ✅ FIX: Use the same time format for chat list
      this.chats = this.chats.map(chat => ({
        ...chat,
        display_time: chat.relative_time || this.formatDisplayTime(this.ensureValidDate(chat.last_message_time || chat.created_at))
      }));

      // Update message times in open chat with the same format
      if (this.selectedChat && this.messages.length > 0) {
        this.messages = this.messages.map(message => ({
          ...message,
          display_time: message.relative_time || this.formatDisplayTime(this.ensureValidDate(message.created_at))
        }));
      }

      // ✅ FIX: Update task comments with the same format
      if (this.selectedTaskForDetails && this.taskComments.length > 0) {
        this.taskComments = this.taskComments.map(comment => ({
          ...comment,
          display_time: comment.relative_time || this.formatDisplayTime(this.ensureValidDate(comment.created_at))
        }));
      }

      this.cdr.detectChanges();
    }, 30000);
  }

  // ✅ FIX: Stop chat time updater
  private stopChatTimeUpdate() {
    if (this.chatTimeUpdateInterval) {
      clearInterval(this.chatTimeUpdateInterval);
      this.chatTimeUpdateInterval = null;
    }
  }

  private saveScrollPosition() {
    const container = document.querySelector('.messages-container');
    if (container) {
      this.scrollPosition = container.scrollTop;
      this.isUserScrolling = container.scrollTop + container.clientHeight < container.scrollHeight - 100;
    }
  }

  private scrollToBottomWithCheck() {
    setTimeout(() => {
      const container = document.querySelector('.messages-container');
      if (container && !this.isUserScrolling) {
        container.scrollTop = container.scrollHeight;
      } else if (container && this.isUserScrolling) {
        container.scrollTop = this.scrollPosition;
      }
    }, 100);
  }

  // ✅ FIX: IMPROVED - Update chat list with proper timing and sender info
  private updateChatListWithNewMessage(message: Message) {
    const chatIndex = this.chats.findIndex(chat => chat.id === message.chat_id);

    if (chatIndex !== -1) {
      this.chats[chatIndex].last_message = message.content;
      this.chats[chatIndex].last_message_time = message.created_at;
      // ✅ FIX: Use the same time format
      this.chats[chatIndex].display_time = message.relative_time || this.formatDisplayTime(this.ensureValidDate(message.created_at));

      if (message.sender_id !== this.user.id) {
        this.chats[chatIndex].unread_count = (this.chats[chatIndex].unread_count || 0) + 1;
      }

      const updatedChat = this.chats.splice(chatIndex, 1)[0];
      this.chats.unshift(updatedChat);
    } else {
      console.log('New chat detected, reloading chats...');
      this.loadChats();
    }

    this.updateChatBadge();
  }

  // ✅ FIX: NEW - Get sender name for group messages
  getMessageSenderName(message: Message): string {
    // If it's the current user's message, show "You"
    if (message.sender_id === this.user.id) {
      return 'You';
    }

    // For group chats, show sender name
    if (this.selectedChat && this.selectedChat.type === 'group') {
      return message.sender_name || 'Unknown User';
    }

    // For private chats, don't show sender name (it's implied)
    return '';
  }

  // ==================== TASK METHODS ====================

  loadTasks() {
    const token = localStorage.getItem('token');

    this.http.get<Task[]>(`${this.API_URL}/tasks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (tasks) => {
        this.tasks = tasks.map(task => {
          const assignedTo = Number(task.assigned_to);
          const taskId = Number(task.id);

          return {
            ...this.calculateTaskTime(task),
            assigned_to: assignedTo,
            id: taskId,
            estimated_hours: Number(task.estimated_hours) || 0,
            time_spent: Number(task.time_spent) || 0,
            progress_percent: Number(task.progress_percent) || 0
          };
        });

        this.calculateStatistics();
        this.calculateEmployeeStatistics();
        this.applyFilter();
        this.startTimers();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Failed to load tasks:', err);
        this.showError('Failed to load tasks. Please check console for details.');
      }
    });
  }

  // ✅ FIX: Load employees based on user role
  loadEmployees() {
    const token = localStorage.getItem('token');

    const endpoint = this.isManager() ? '/employees' : '/employees/accessible';

    this.http.get<Employee[]>(`${this.API_URL}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (employees) => {
        this.employees = employees.map(emp => ({
          ...emp,
          id: Number(emp.id)
        }));
        console.log(`✅ Loaded ${this.employees.length} employees for ${this.user.role}`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Failed to load employees:', err);
        if (this.isEmployee()) {
          this.createFallbackEmployees();
        }
      }
    });
  }

  // ==================== PROJECT MANAGEMENT METHODS ====================

  loadProjects() {
    const token = localStorage.getItem('token');
    this.http.get<Project[]>(`${this.API_URL}/projects`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (projects) => {
        this.projects = projects;
        console.log('✅ Loaded projects:', projects.length);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Failed to load projects:', err);
      }
    });
  }

  openProjectModal() {
    this.showProjectModal = true;
    this.resetProjectForm();
  }

  closeProjectModal() {
    this.showProjectModal = false;
    this.resetProjectForm();
  }

  resetProjectForm() {
    this.newProject = {
      name: '',
      client_name: '',
      description: '',
      status: 'active',
      start_date: '',
      end_date: '',
      budget: null,
      priority: 'medium',
      employee_ids: []
    };
  }

  toggleProjectEmployee(employeeId: number) {
    const index = this.newProject.employee_ids.indexOf(employeeId);
    if (index > -1) {
      this.newProject.employee_ids.splice(index, 1);
    } else {
      this.newProject.employee_ids.push(employeeId);
    }
  }

  isProjectEmployeeSelected(employeeId: number): boolean {
    return this.newProject.employee_ids.includes(employeeId);
  }

  createProject() {
    if (!this.newProject.name || !this.newProject.client_name) {
      this.showError('Project name and client name are required');
      return;
    }

    const token = localStorage.getItem('token');
    this.http.post<{ message: string; project: Project }>(`${this.API_URL}/projects`, this.newProject, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        this.showSuccess(response.message);
        this.closeProjectModal();
        this.loadProjects();
      },
      error: (err) => {
        console.error('❌ Failed to create project:', err);
        this.showError('Failed to create project. Please try again.');
      }
    });
  }

  viewProjectDetails(project: Project) {
    const token = localStorage.getItem('token');
    this.http.get<Project>(`${this.API_URL}/projects/${project.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (projectDetails) => {
        this.selectedProject = projectDetails;
        this.showProjectDetails = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Failed to load project details:', err);
        this.showError('Failed to load project details');
      }
    });
  }

  closeProjectDetails() {
    this.selectedProject = null;
    this.showProjectDetails = false;
  }

  updateProjectStatus(project: Project, status: string) {
    const token = localStorage.getItem('token');
    this.http.put<{ message: string }>(`${this.API_URL}/projects/${project.id}`, { status }, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.showSuccess('Project status updated');
        this.loadProjects();
        if (this.selectedProject && this.selectedProject.id === project.id) {
          this.viewProjectDetails(project);
        }
      },
      error: (err) => {
        console.error('❌ Failed to update project:', err);
        this.showError('Failed to update project status');
      }
    });
  }

  deleteProject(project: Project) {
    if (!confirm(`Are you sure you want to delete project "${project.name}"? This action cannot be undone.`)) {
      return;
    }

    const token = localStorage.getItem('token');
    this.http.delete(`${this.API_URL}/projects/${project.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.showSuccess('Project deleted successfully');
        this.loadProjects();
        this.closeProjectDetails();
      },
      error: (err) => {
        console.error('❌ Failed to delete project:', err);
        this.showError('Failed to delete project');
      }
    });
  }

  openAssignEmployees(project: Project) {
    this.selectedProject = project;
    this.showAssignEmployees = true;
    this.projectEmployeesToAssign = project.employees?.map(e => e.employee_id) || [];
  }

  closeAssignEmployees() {
    this.showAssignEmployees = false;
    this.projectEmployeesToAssign = [];
  }

  toggleEmployeeAssignment(employeeId: number) {
    const index = this.projectEmployeesToAssign.indexOf(employeeId);
    if (index > -1) {
      this.projectEmployeesToAssign.splice(index, 1);
    } else {
      this.projectEmployeesToAssign.push(employeeId);
    }
  }

  isEmployeeAssigned(employeeId: number): boolean {
    return this.projectEmployeesToAssign.includes(employeeId);
  }

  saveEmployeeAssignments() {
    if (!this.selectedProject) return;

    const token = localStorage.getItem('token');
    this.http.post(`${this.API_URL}/projects/${this.selectedProject.id}/employees`, {
      employee_ids: this.projectEmployeesToAssign
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.showSuccess('Employees assigned successfully');
        this.closeAssignEmployees();
        this.loadProjects();
        if (this.selectedProject) {
          this.viewProjectDetails(this.selectedProject);
        }
      },
      error: (err) => {
        console.error('❌ Failed to assign employees:', err);
        this.showError('Failed to assign employees');
      }
    });
  }

  removeEmployeeFromProject(projectId: number, employeeId: number) {
    const token = localStorage.getItem('token');
    this.http.delete(`${this.API_URL}/projects/${projectId}/employees/${employeeId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.showSuccess('Employee removed from project');
        if (this.selectedProject) {
          this.viewProjectDetails(this.selectedProject);
        }
        this.loadProjects();
      },
      error: (err) => {
        console.error('❌ Failed to remove employee:', err);
        this.showError('Failed to remove employee from project');
      }
    });
  }

  getProjectProgress(project: Project): number {
    if (!project.task_count || project.task_count === 0) return 0;
    return Math.round(((project.completed_tasks || 0) / project.task_count) * 100);
  }

  getProjectStatusClass(status: string): string {
    switch (status) {
      case 'active': return 'status-active';
      case 'completed': return 'status-completed';
      case 'on_hold': return 'status-on-hold';
      case 'cancelled': return 'status-cancelled';
      default: return '';
    }
  }

  // ==================== TASK CREATION METHODS ====================

  openCreateTaskModal() {
    this.showCreateTaskModal = true;
    this.resetTaskForm();
  }

  closeCreateTaskModal() {
    this.showCreateTaskModal = false;
    this.resetTaskForm();
  }

  resetTaskForm() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);

    this.newTask = {
      title: '',
      description: '',
      assigned_to: null,
      assigned_employees: [],
      priority: 'medium',
      due_date: tomorrow.toISOString().slice(0, 16),
      estimated_hours: 1,
      project_id: null,
      project_name: '',
      client_name: ''
    };
  }

  applyTemplate(template: any) {
    this.newTask.priority = template.priority;
    this.newTask.estimated_hours = template.estimated_hours;
    this.newTask.description = template.description;
    this.newTask.title = template.name;
  }

  toggleTaskEmployee(employeeId: number) {
    const index = this.newTask.assigned_employees.indexOf(employeeId);
    if (index > -1) {
      this.newTask.assigned_employees.splice(index, 1);
    } else {
      this.newTask.assigned_employees.push(employeeId);
    }
    // Set the first selected employee as the primary assignee
    if (this.newTask.assigned_employees.length > 0) {
      this.newTask.assigned_to = this.newTask.assigned_employees[0];
    } else {
      this.newTask.assigned_to = null;
    }
  }

  isTaskEmployeeSelected(employeeId: number): boolean {
    return this.newTask.assigned_employees.includes(employeeId);
  }

  getSelectedProjectName(): string {
    if (!this.newTask.project_id) return 'No Project';
    const project = this.projects.find(p => p.id === this.newTask.project_id);
    return project ? `${project.name} (${project.client_name})` : 'No Project';
  }

  onProjectSelect() {
    if (this.newTask.project_id) {
      const project = this.projects.find(p => p.id === Number(this.newTask.project_id));
      if (project) {
        this.newTask.project_name = project.name;
        this.newTask.client_name = project.client_name;
      }
    }
  }

  createTask() {
    if (!this.newTask.title) {
      this.showError('Task title is required');
      return;
    }

    if (this.newTask.assigned_employees.length === 0) {
      this.showError('Please assign at least one employee');
      return;
    }

    if (!this.newTask.due_date) {
      this.showError('Due date is required');
      return;
    }

    const token = localStorage.getItem('token');

    // Create tasks for all selected employees
    const createPromises = this.newTask.assigned_employees.map(employeeId => {
      const taskData: any = {
        title: this.newTask.title,
        description: this.newTask.description,
        assigned_to: employeeId,
        priority: this.newTask.priority,
        due_date: this.newTask.due_date,
        estimated_hours: this.newTask.estimated_hours,
        project_id: this.newTask.project_id,
        project_name: this.newTask.project_name,
        client_name: this.newTask.client_name
      };

      return this.http.post<Task>(`${this.API_URL}/tasks`, taskData, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).toPromise();
    });

    Promise.all(createPromises)
      .then(() => {
        const count = this.newTask.assigned_employees.length;
        this.showSuccess(`${count} task(s) created successfully!`);
        this.closeCreateTaskModal();
        this.loadTasks();
      })
      .catch(err => {
        console.error('❌ Failed to create tasks:', err);
        this.showError('Failed to create tasks. Please try again.');
      });
  }

  // ==================== BULK TASK OPERATIONS ====================

  toggleTaskSelection(task: Task) {
    const index = this.selectedTasks.indexOf(task.id);
    if (index > -1) {
      this.selectedTasks.splice(index, 1);
    } else {
      this.selectedTasks.push(task.id);
    }
    this.showBulkActions = this.selectedTasks.length > 0;
  }

  isTaskSelected(taskId: number): boolean {
    return this.selectedTasks.includes(taskId);
  }

  selectAllTasks() {
    if (this.selectedTasks.length === this.filteredTasks.length) {
      this.selectedTasks = [];
    } else {
      this.selectedTasks = this.filteredTasks.map(t => t.id);
    }
    this.showBulkActions = this.selectedTasks.length > 0;
  }

  bulkUpdateStatus(status: string) {
    if (this.selectedTasks.length === 0) return;

    const token = localStorage.getItem('token');
    this.http.put<{ message: string }>(`${this.API_URL}/tasks/bulk-status`, {
      task_ids: this.selectedTasks,
      status
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        this.showSuccess(response.message);
        this.selectedTasks = [];
        this.showBulkActions = false;
        this.loadTasks();
      },
      error: (err) => {
        console.error('❌ Bulk update failed:', err);
        this.showError('Failed to update tasks');
      }
    });
  }

  duplicateTask(task: Task) {
    const token = localStorage.getItem('token');
    this.http.post<{ message: string; task: Task }>(`${this.API_URL}/tasks/${task.id}/duplicate`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        this.showSuccess(response.message);
        this.loadTasks();
      },
      error: (err) => {
        console.error('❌ Failed to duplicate task:', err);
        this.showError('Failed to duplicate task');
      }
    });
  }

  // ✅ FIX: Create fallback employees for employees
  private createFallbackEmployees() {
    console.log('🔄 Creating fallback employees list...');

    this.employees = [
      {
        id: 1,
        name: 'Faizan Hamza',
        email: 'Faizan@XtroEdge.com'
      }
    ];

    console.log('✅ Fallback employees created:', this.employees);
    this.cdr.detectChanges();
  }

  // ✅ FIX: Load all employees for manager
  loadAllEmployees() {
    if (!this.isManager()) {
      return;
    }

    const token = localStorage.getItem('token');

    this.http.get<Employee[]>(`${this.API_URL}/employees`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (employees) => {
        this.employees = employees.map(emp => ({
          ...emp,
          id: Number(emp.id)
        }));
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Failed to load all employees:', err);
        this.showError('Failed to load employees list.');
      }
    });
  }

  // ✅ FIX: Start chat with employee (for manager)
  startChatWithEmployee(employee: Employee) {
    const token = localStorage.getItem('token');

    this.http.post<Chat>(`${this.API_URL}/chats/start`, {
      participant_id: employee.id
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (chat) => {
        this.isChatOpen = true;
        this.selectedChat = chat;
        this.loadMessages(chat.id);
        this.loadChats();
        this.showEmployeesList = false;
        this.showSuccess(`Started chat with ${employee.name}`);

        setTimeout(() => {
          if (this.messageInput) {
            this.messageInput.nativeElement.focus();
          }
        }, 300);
      },
      error: (err) => {
        console.error('Failed to start chat:', err);
        this.showError('Failed to start chat. Please try again.');
      }
    });
  }

  // ✅ FIX: Beautiful task details styling
  viewTaskDetails(task: Task) {
    this.selectedTaskForDetails = task;
    this.loadTaskComments(task.id);

    setTimeout(() => {
      const modal = document.querySelector('.modal.modal-large');
      if (modal) {
        modal.classList.add('modal-beautiful');
      }
    }, 10);
  }

  closeTaskDetails() {
    this.selectedTaskForDetails = null;
    this.taskComments = [];
  }

  updateProgress(task: Task) {
    const token = localStorage.getItem('token');

    const updateData = {
      ...this.progressUpdate,
      status: this.progressUpdate.progress_percent === 100 ? 'completed' : task.status
    };

    console.log('📤 Sending progress update:', updateData);

    this.http.put(`${this.API_URL}/tasks/${task.id}`, updateData, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        console.log('✅ Progress updated successfully:', response);
        this.loadTasks();
        this.selectedTask = null;
        this.resetProgressForm();

        if (updateData.progress_percent === 100) {
          this.showSuccess('🎉 Task marked as completed! Progress set to 100%.');
        } else {
          this.showSuccess('✅ Progress updated successfully!');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Failed to update progress:', err);
        this.showError('Failed to update progress. Please check console for details.');
      }
    });
  }

  resetProgressForm() {
    this.progressUpdate = {
      progress_percent: 0,
      notes: '',
      time_spent: 0
    };
  }

  initializeProgressUpdate(task: Task) {
    this.selectedTask = task;
    this.progressUpdate = {
      progress_percent: task.progress_percent || 0,
      notes: '',
      time_spent: task.time_spent || 0
    };
  }

  quickProgressUpdate(task: Task, percent: number) {
    this.progressUpdate.progress_percent = percent;
    this.progressUpdate.notes = `Quick update to ${percent}%`;
    this.updateProgress(task);
  }

  updateTaskStatus(task: Task, status: string) {
    const token = localStorage.getItem('token');

    const updateData: any = { status };

    if (status === 'completed') {
      updateData.progress_percent = 100;
      updateData.notes = 'Task marked as completed';
    }

    if (status === 'in_progress' && task.progress_percent === 0) {
      updateData.progress_percent = 1;
    }

    this.http.put(`${this.API_URL}/tasks/${task.id}`, updateData, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: () => {
        console.log('✅ Task status updated to:', status);
        if (status === 'completed') {
          this.showSuccess('🎉 Task marked as completed! Progress set to 100%.');
        }
        this.loadTasks();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Failed to update status:', err);
        this.showError('Failed to update task status. Please try again.');
      }
    });
  }

  // ==================== CHAT METHODS ====================

  toggleChat() {
    this.isChatOpen = !this.isChatOpen;
    if (this.isChatOpen) {
      this.loadChats();
      this.startChatAutoRefresh();
      setTimeout(() => {
        if (this.messageInput) {
          this.messageInput.nativeElement.focus();
        }
      }, 300);
    } else {
      this.selectedChat = null;
      this.messages = [];
      this.stopChatAutoRefresh();
    }
    this.cdr.detectChanges();
  }

  loadChats() {
    const token = localStorage.getItem('token');
    this.http.get<Chat[]>(`${this.API_URL}/chats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (chats) => {
        const uniqueChats = this.removeDuplicateChats(chats);

        const previousSelectedChatId = this.selectedChat?.id;

        // ✅ FIX: Use the same time format for all chat times
        this.chats = uniqueChats.map(chat => ({
          ...chat,
          last_message_time: chat.last_message_time ? this.ensureValidDate(chat.last_message_time) : undefined,
          display_time: chat.relative_time || this.formatDisplayTime(this.ensureValidDate(chat.last_message_time || chat.created_at)),
          unread_count: Number(chat.unread_count) || 0
        }));

        console.log('Loaded chats:', this.chats);

        if (previousSelectedChatId) {
          const restoredChat = this.chats.find(chat => chat.id === previousSelectedChatId);
          if (restoredChat) {
            this.selectedChat = restoredChat;
            this.loadMessages(restoredChat.id);
          }
        }

        this.updateChatBadge();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load chats:', err);
      }
    });
  }

  private removeDuplicateChats(chats: Chat[]): Chat[] {
    const uniqueChats = new Map();
    chats.forEach(chat => {
      if (!uniqueChats.has(chat.id)) {
        uniqueChats.set(chat.id, chat);
      }
    });
    return Array.from(uniqueChats.values());
  }

  selectChat(chat: Chat) {
    this.selectedChat = chat;
    this.loadMessages(chat.id);
    this.markChatAsRead(chat.id);

    this.isUserScrolling = false;
    this.scrollPosition = 0;

    setTimeout(() => {
      if (this.messageInput) {
        this.messageInput.nativeElement.focus();
      }
    }, 300);

    this.cdr.detectChanges();
  }

  // ✅ FIX: IMPROVED - Load messages with better error handling
  loadMessages(chatId: number) {
    const token = localStorage.getItem('token');
    this.http.get<Message[]>(`${this.API_URL}/chats/${chatId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (messages) => {
        const newMessagesHash = this.createMessagesHash(messages);
        if (newMessagesHash === this.lastMessagesHash && this.messages.length === messages.length) {
          return;
        }

        this.lastMessagesHash = newMessagesHash;

        this.saveScrollPosition();

        // ✅ FIX: CORRECTED - Use proper time formatting for messages
        this.messages = messages.map(message => ({
          ...message,
          created_at: this.ensureValidDate(message.created_at),
          display_time: message.relative_time || this.formatDisplayTime(this.ensureValidDate(message.created_at))
        }));

        this.scrollToBottomWithCheck();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load messages:', err);
        this.showError('Failed to load messages. Please try again.');
      }
    });
  }

  // ✅ FIX: Create hash for all messages to detect changes
  private createMessagesHash(messages: Message[]): string {
    return messages.map(msg => this.createMessageHash(msg)).join('|');
  }

  onMessagesScroll(event: Event) {
    const container = event.target as HTMLElement;
    const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50;
    this.isUserScrolling = !isNearBottom;

    if (isNearBottom) {
      this.scrollPosition = container.scrollHeight;
    } else {
      this.scrollPosition = container.scrollTop;
    }
  }

  markChatAsRead(chatId: number) {
    const token = localStorage.getItem('token');
    this.http.put(`${this.API_URL}/chats/${chatId}/mark-read`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: () => {
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
          chat.unread_count = 0;
          this.updateChatBadge();
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Failed to mark chat as read:', err);
      }
    });
  }

  // ✅ FIX: Improved send message with duplicate prevention - FIXED
  sendMessage() {
    if (!this.newMessage.trim() || !this.selectedChat || this.isSendingMessage) return;

    this.isSendingMessage = true;

    const messageKey = `${this.selectedChat.id}_${this.user.id}_${this.newMessage}_${Date.now()}`;

    if (this.sentMessageTracker.has(messageKey)) {
      console.log('🔄 Duplicate message prevented');
      this.isSendingMessage = false;
      return;
    }

    this.sentMessageTracker.add(messageKey);

    setTimeout(() => {
      this.sentMessageTracker.delete(messageKey);
    }, 5000);

    const token = localStorage.getItem('token');
    const messageContent = this.newMessage.trim();

    this.newMessage = '';

    this.http.post<Message>(`${this.API_URL}/chats/${this.selectedChat.id}/messages`, {
      content: messageContent,
      message_type: 'text'
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (message) => {
        this.sentMessageIds.add(message.id);

        // ✅ FIX: CORRECTED - Use proper time formatting
        const formattedMessage = {
          ...message,
          created_at: this.ensureValidDate(message.created_at),
          display_time: message.relative_time || this.formatDisplayTime(this.ensureValidDate(message.created_at))
        };

        const messageExists = this.messages.some(msg => msg.id === message.id);
        if (!messageExists) {
          this.messages.push(formattedMessage);
        }

        this.scrollToBottom();

        this.updateChatAfterSendingMessage(formattedMessage);

        this.isTyping = false;
        this.typingUsers = [];

        this.updateChatBadge();

        this.isSendingMessage = false;

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to send message:', err);
        this.showError('Failed to send message. Please try again.');

        this.newMessage = messageContent;

        this.isSendingMessage = false;
      }
    });
  }

  // ✅ FIX: Update chat time after sending message with the same time format
  private updateChatAfterSendingMessage(message: Message) {
    const chatIndex = this.chats.findIndex(chat => chat.id === message.chat_id);

    if (chatIndex !== -1) {
      this.chats[chatIndex].last_message = message.content;
      this.chats[chatIndex].last_message_time = message.created_at;
      // ✅ FIX: Use the same time format
      this.chats[chatIndex].display_time = message.relative_time || this.formatDisplayTime(this.ensureValidDate(message.created_at));

      const updatedChat = this.chats.splice(chatIndex, 1)[0];
      this.chats.unshift(updatedChat);
    }
  }

  backToChats() {
    this.selectedChat = null;
    this.messages = [];
    this.loadChats();
    this.cdr.detectChanges();
  }

  // ==================== GROUP CHAT METHODS ====================

  createGroupChat() {
    this.showGroupCreation = true;
  }

  closeGroupCreation() {
    this.showGroupCreation = false;
    this.groupName = '';
    this.selectedEmployees = [];
  }

  createGroup() {
    if (!this.groupName.trim() || this.selectedEmployees.length === 0) {
      this.showError('Please enter group name and select at least one employee');
      return;
    }

    const token = localStorage.getItem('token');
    this.http.post<{ chat_id: number; message: string }>(`${this.API_URL}/chats/group`, {
      name: this.groupName.trim(),
      participant_ids: this.selectedEmployees
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        this.showSuccess(response.message);
        this.closeGroupCreation();
        this.loadChats();
      },
      error: (err) => {
        console.error('Failed to create group chat:', err);
        const errorMsg = err.error?.message || 'Failed to create group chat. Please try again.';
        this.showError(errorMsg);
      }
    });
  }

  toggleEmployeeSelection(employeeId: number) {
    const index = this.selectedEmployees.indexOf(employeeId);
    if (index > -1) {
      this.selectedEmployees.splice(index, 1);
    } else {
      this.selectedEmployees.push(employeeId);
    }
  }

  // ==================== COMMENTS METHODS ====================

  loadTaskComments(taskId: number) {
    const token = localStorage.getItem('token');
    this.http.get<TaskComment[]>(`${this.API_URL}/tasks/${taskId}/comments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (comments) => {
        // ✅ FIX: CORRECTED - Use proper time formatting for comments
        this.taskComments = comments.map(comment => ({
          ...comment,
          display_time: comment.relative_time || this.formatDisplayTime(this.ensureValidDate(comment.created_at))
        }));
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load comments:', err);
      }
    });
  }

  // ✅ FIX: FIXED - Improved addComment method with throttling and better error handling
  addComment() {
    if (!this.newComment.trim() || !this.selectedTaskForDetails) return;

    const now = Date.now();
    const timeSinceLastComment = now - this.lastCommentTime;

    if (this.isAddingComment) {
      console.log('⏳ Comment already in progress, please wait...');
      this.showError('Please wait, previous comment is being processed...');
      return;
    }

    if (timeSinceLastComment < this.COMMENT_THROTTLE_TIME) {
      console.log('⏳ Comment throttled, please wait...');
      this.showError('Please wait a moment before adding another comment...');
      return;
    }

    const commentText = this.newComment.trim();
    const taskId = this.selectedTaskForDetails.id;

    this.newComment = '';

    this.isAddingComment = true;
    this.lastCommentTime = now;

    const token = localStorage.getItem('token');

    console.log('📤 Sending comment for task:', taskId, 'Content:', commentText);

    this.http.post<TaskComment>(`${this.API_URL}/tasks/${taskId}/comments`, {
      comment: commentText
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (comment) => {
        console.log('✅ Comment added successfully:', comment);

        // ✅ FIX: CORRECTED - Use proper time formatting for comments
        const formattedComment = {
          ...comment,
          display_time: comment.relative_time || this.formatDisplayTime(this.ensureValidDate(comment.created_at))
        };

        this.taskComments.push(formattedComment);

        this.showSuccess('Comment added successfully!');

        const commentKey = `comment_${taskId}_${this.user.id}_${comment.id}`;
        this.processedCommentNotifications.add(commentKey);

        setTimeout(() => {
          this.processedCommentNotifications.delete(commentKey);
        }, 60000);

        if (this.socket) {
          this.socket.emit('new_comment', {
            task_id: taskId,
            task_title: this.selectedTaskForDetails?.title,
            task_assigned_to: this.selectedTaskForDetails?.assigned_to,
            commenter_id: this.user.id,
            commenter_name: this.user.name,
            comment: commentText,
            comment_id: comment.id,
            created_at: new Date().toISOString(),
            is_source: true
          });
        }

        this.isAddingComment = false;

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Failed to add comment:', err);

        let errorMessage = 'Failed to add comment. Please try again.';

        if (err.status === 400) {
          errorMessage = 'Comment too short or invalid. Please check your comment.';
        } else if (err.status === 429) {
          errorMessage = 'Too many comments too quickly. Please wait a moment.';
        } else if (err.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }

        this.showError(errorMessage);

        this.newComment = commentText;

        this.isAddingComment = false;

        this.cdr.detectChanges();
      }
    });
  }

  // ==================== NOTIFICATIONS METHODS ====================

  // ✅ FIX: UPDATED - Load notifications with proper timing
  loadNotifications() {
    const token = localStorage.getItem('token');
    this.http.get<Notification[]>(`${this.API_URL}/notifications`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (notifications) => {
        this.lastNotificationCheck = new Date();

        this.notificationIds.clear();

        // ✅ FIX: CORRECTED - Use proper time formatting for notifications
        this.notifications = notifications.map(notification => {
          this.notificationIds.add(notification.id);
          const validDate = this.ensureValidDate(notification.created_at);
          return {
            ...notification,
            created_at: validDate,
            // ✅ FIX: Use proper time formatting
            display_time: notification.relative_time || this.formatDisplayTime(validDate)
          };
        });

        this.updateUnreadCount();

        if (!this.hasShownInitialAlert) {
          this.hasShownInitialAlert = true;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load notifications:', err);
      }
    });
  }

  updateUnreadCount() {
    this.unreadNotifications = this.notifications.filter(n => !n.is_read).length;
    this.cdr.detectChanges();
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.loadNotifications();
    }
    this.cdr.detectChanges();
  }

  markNotificationAsRead(notification: Notification) {
    if (notification.is_read) return;

    const token = localStorage.getItem('token');
    this.http.put(`${this.API_URL}/notifications/${notification.id}/read`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: () => {
        notification.is_read = true;
        this.updateUnreadCount();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to mark notification as read:', err);
      }
    });
  }

  // ✅ FIX: Improved delete notification with proper toast
  deleteNotification(notification: Notification, event: Event) {
    event.stopPropagation();

    const token = localStorage.getItem('token');
    this.http.delete(`${this.API_URL}/notifications/${notification.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (response: any) => {
        this.notifications = this.notifications.filter(n => n.id !== notification.id);
        this.notificationIds.delete(notification.id);
        this.updateUnreadCount();

        this.showDeleteToastMessage('Notification deleted successfully!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Failed to delete notification:', err);
        this.showError('Failed to delete notification. Please try again.');
      }
    });
  }

  // ✅ FIX: Show delete toast message
  private showDeleteToastMessage(message: string) {
    this.deleteToastMessage = message;
    this.showDeleteToast = true;

    setTimeout(() => {
      this.showDeleteToast = false;
      this.deleteToastMessage = '';
    }, 2000);
  }

  markAllNotificationsAsRead() {
    const token = localStorage.getItem('token');
    this.http.put(`${this.API_URL}/notifications/read-all`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.notifications.forEach(n => n.is_read = true);
        this.updateUnreadCount();
        if (this.showNotifications) {
          this.showSuccess('All notifications marked as read!');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to mark all notifications as read:', err);
        this.showError('Failed to mark notifications as read.');
      }
    });
  }

  // ==================== HELPER METHODS ====================

  private showSuccess(message: string) {
    this.showToast(message, 'success');
  }

  private showError(message: string) {
    this.showToast(message, 'error');
  }

  private showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.innerHTML = `
      <div class="toast-header">
        <div class="toast-title">${type === 'success' ? '✅ Success' : type === 'error' ? '❌ Error' : '⚠️ Warning'}</div>
        <button class="toast-close">×</button>
      </div>
      <div class="toast-body">${message}</div>
    `;

    document.body.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn?.addEventListener('click', () => {
      toast.remove();
    });

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 5000);
  }

  // Chat auto-refresh methods
  private startChatAutoRefresh() {
    this.stopChatAutoRefresh();

    this.chatRefreshTimer = setInterval(() => {
      if (this.isChatOpen && !this.isUserScrolling) {
        this.loadChats();

        if (this.selectedChat) {
          this.loadMessages(this.selectedChat.id);
        }
      }
    }, 10000);
  }

  private stopChatAutoRefresh() {
    if (this.chatRefreshTimer) {
      clearInterval(this.chatRefreshTimer);
      this.chatRefreshTimer = null;
    }
  }

  // ✅ FIX: Improved chat badge update
  private updateChatBadge() {
    this.cdr.detectChanges();

    const totalUnread = this.getTotalUnreadChats();
    console.log('Updated chat badge count:', totalUnread);
  }

  scrollToBottom() {
    setTimeout(() => {
      const container = document.querySelector('.messages-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  calculateStatistics() {
    let tasksToCalculate = this.tasks;

    if (this.isEmployee()) {
      tasksToCalculate = this.tasks.filter(task =>
        Number(task.assigned_to) === Number(this.getUserId())
      );
    }

    const filteredTasks = this.filterTasksByTimeRange(tasksToCalculate);

    this.totalTasks = filteredTasks.length;
    this.inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress').length;
    this.overdueTasks = filteredTasks.filter(t => t.is_overdue).length;
    this.completedTasks = filteredTasks.filter(t => t.status === 'completed').length;
    this.pendingTasks = filteredTasks.filter(t => t.status === 'pending').length;
    this.cdr.detectChanges();
  }

  calculateEmployeeStatistics() {
    const employeeMap = new Map<number, EmployeeStats>();

    let tasksToCalculate = this.tasks;
    if (this.isEmployee()) {
      tasksToCalculate = this.tasks.filter(task =>
        Number(task.assigned_to) === Number(this.getUserId())
      );
    }

    const filteredTasks = this.filterTasksByTimeRange(tasksToCalculate);

    filteredTasks.forEach(task => {
      if (!employeeMap.has(task.assigned_to)) {
        employeeMap.set(task.assigned_to, {
          employee_id: task.assigned_to,
          employee_name: task.assigned_to_name,
          total_tasks: 0,
          in_progress_tasks: 0,
          overdue_tasks: 0,
          completed_tasks: 0,
          pending_tasks: 0
        });
      }

      const stats = employeeMap.get(task.assigned_to)!;
      stats.total_tasks++;

      switch (task.status) {
        case 'in_progress':
          stats.in_progress_tasks++;
          break;
        case 'completed':
          stats.completed_tasks++;
          break;
        case 'pending':
          stats.pending_tasks++;
          break;
      }

      if (task.is_overdue) {
        stats.overdue_tasks++;
      }
    });

    this.employeeStats = Array.from(employeeMap.values());

    if (this.isManager() && this.filterEmployee !== 'all') {
      const employeeId = parseInt(this.filterEmployee);
      this.selectedEmployeeStats = this.employeeStats.find(stat => stat.employee_id === employeeId) || null;
    } else {
      this.selectedEmployeeStats = null;
    }
    this.cdr.detectChanges();
  }

  filterTasksByTimeRange(tasks: Task[]): Task[] {
    const now = new Date();

    switch (this.filterTimeRange) {
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

      case 'lifetime':
      default:
        return tasks;
    }
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

  startTimers() {
    this.timers.forEach(timer => clearInterval(timer));
    this.timers = [];

    const timer = setInterval(() => {
      this.tasks = this.tasks.map(task => this.calculateTaskTime(task));
      this.calculateStatistics();
      this.calculateEmployeeStatistics();
      this.applyFilter();
      this.cdr.detectChanges();
    }, 1000);
    this.timers.push(timer);
  }

  startAutoRefresh() {
    const refreshTimer = setInterval(() => {
      this.loadNotifications();
      if (this.isChatOpen && this.selectedChat) {
        this.loadMessages(this.selectedChat.id);
      } else if (this.isChatOpen) {
        this.loadChats();
      }
    }, 10000);
    this.timers.push(refreshTimer);
  }

  applyFilter() {
    let filtered = this.filterTasksByTimeRange(this.tasks);

    if (this.isEmployee()) {
      const userId = Number(this.getUserId());
      filtered = filtered.filter(task => {
        const taskAssignedTo = Number(task.assigned_to);
        return taskAssignedTo === userId;
      });
      this.filterEmployee = 'all';
    }

    if (this.filterStatus !== 'all') {
      if (this.filterStatus === 'overdue') {
        filtered = filtered.filter(task => task.is_overdue);
      } else {
        filtered = filtered.filter(task => task.status === this.filterStatus);
      }
    }

    if (this.isManager() && this.filterEmployee !== 'all') {
      const employeeId = parseInt(this.filterEmployee);
      filtered = filtered.filter(task => {
        const taskAssignedTo = Number(task.assigned_to);
        return taskAssignedTo === employeeId;
      });
    }

    // Filter by project
    if (this.isManager() && this.filterProject !== 'all') {
      if (this.filterProject === 'none') {
        filtered = filtered.filter(task => !task.project_id);
      } else {
        const projectId = parseInt(this.filterProject);
        filtered = filtered.filter(task => task.project_id === projectId);
      }
    }

    this.filteredTasks = filtered;
    this.calculateEmployeeStatistics();
    this.cdr.detectChanges();
  }

  onFilterChange() {
    this.applyFilter();
  }

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

  getUserId(): number {
    if (this.user.id) {
      return Number(this.user.id);
    } else if (this.user.userId) {
      return Number(this.user.userId);
    } else {
      console.error('❌ No user ID found in user object:', this.user);
      return 0;
    }
  }

  isManager(): boolean {
    return this.user?.role === 'manager';
  }

  isEmployee(): boolean {
    return this.user?.role === 'employee';
  }

  shouldShowChatAndNotifications(): boolean {
    return this.isEmployee() || this.isManager();
  }

  @HostListener('window:focus')
  onWindowFocus() {
    // Don't automatically mark all notifications as read when window focuses
  }
}