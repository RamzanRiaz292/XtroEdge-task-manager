import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ElementRef, ViewChild, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';

// Interface definitions with proper types
export interface IChat {
  id: number;
  type: string;
  name?: string;
  other_user_id: number;
  other_user_name: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  is_group?: boolean;
}

export interface IMessage {
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
}

export interface IUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

export interface IEmployee {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
  position?: string;
  avatar?: string;
  isOnline?: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss']
})
export class Chat implements OnInit, OnDestroy {
  @Input() position: 'left' | 'right' = 'right';
  @Input() currentUser: any;
  @Output() toggleChat = new EventEmitter<void>();
  
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('messageTextarea') private messageTextarea!: ElementRef;

  // UI States
  isOpen = false;
  showEmployees: boolean = false; // Default to false for better UX
  showGroupCreation = false;
  
  // Data
  chats: IChat[] = [];
  selectedChat: IChat | null = null;
  messages: IMessage[] = [];
  employees: IEmployee[] = [];
  
  // User Inputs
  newMessage = '';
  groupName = '';
  selectedEmployees: number[] = [];
  employeeSearch: string = ''; // Added for search functionality
  
  // Real-time features
  isTyping = false;
  typingUsers: string[] = [];
  onlineUsers: Set<number> = new Set();
  
  // Loading states
  isLoadingChats = false;
  isLoadingMessages = false;
  isLoadingEmployees = false;
  
  // WebSocket
  private socket: Socket | null = null;
  private refreshInterval: any;
  private readonly API_URL = this.getApiUrl();

  private getApiUrl(): string {
    const currentUrl = window.location.href;
    if (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
      return 'http://localhost:3000/api';
    } else {
      return 'https://xtro-edge-task-manager-backend.vercel.app/api';
    }
  }
  
  // Prevent duplicates and debounce
  private sentMessageIds: Set<number> = new Set();
  private lastMessageTime: number = 0;
  private messageDebounceTimeout: any;
  private loadingTimeouts: any[] = [];
  private typingTimeout: any;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    if (!this.currentUser) {
      const userData = localStorage.getItem('user');
      this.currentUser = userData ? JSON.parse(userData) : null;
    }
  }

  ngOnInit() {
    console.log('Chat Component Initialized');
    this.loadEmployees();
    this.initializeWebSocket();
    this.startAutoRefresh();
    this.requestNotificationPermission();
    
    // Auto-focus on chat panel when opened
    setTimeout(() => {
      if (this.isOpen && this.messageTextarea) {
        this.messageTextarea.nativeElement.focus();
      }
    }, 500);
  }

  ngOnDestroy() {
    this.cleanup();
  }

  // ==================== GETTERS FOR FILTERED DATA ====================

  get filteredEmployees(): IEmployee[] {
    if (!this.employeeSearch.trim()) {
      return this.employees;
    }
    
    const searchTerm = this.employeeSearch.toLowerCase();
    return this.employees.filter(employee => 
      employee.name.toLowerCase().includes(searchTerm) ||
      employee.email.toLowerCase().includes(searchTerm) ||
      employee.role.toLowerCase().includes(searchTerm) ||
      (employee.department && employee.department.toLowerCase().includes(searchTerm))
    );
  }

  // ==================== INITIALIZATION & CLEANUP ====================

  private cleanup() {
    this.loadingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.loadingTimeouts = [];
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    if (this.messageDebounceTimeout) {
      clearTimeout(this.messageDebounceTimeout);
    }
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  private requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications.');
      return;
    }
    
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }

  // ==================== WEB SOCKET INTEGRATION ====================

  private initializeWebSocket() {
    try {
      this.socket = io(this.API_URL.replace('/api', ''), {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        auth: {
          token: localStorage.getItem('token') || ''
        }
      });

      this.socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        if (this.currentUser) {
          this.socket?.emit('authenticate', {
            userId: this.currentUser.id,
            name: this.currentUser.name,
            role: this.currentUser.role
          });
        }
      });

      this.socket.on('new_message', (message: IMessage) => {
        this.handleNewMessage(message);
      });

      this.socket.on('user_typing', (data: any) => {
        this.handleTypingIndicator(data);
      });

      this.socket.on('user_online_status', (data: any) => {
        this.handleOnlineStatus(data);
      });

      this.socket.on('messages_read', (data: any) => {
        this.handleMessagesRead(data);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
      });

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  // ==================== NOTIFICATION HANDLERS ====================

  private handleNewMessage(message: IMessage) {
    const isDuplicate = this.messages.some(m => m.id === message.id);
    const isSelfSent = message.sender_id === this.currentUser?.id;
    
    if (!isDuplicate) {
      if (this.selectedChat && this.selectedChat.id === message.chat_id) {
        this.messages.push(message);
        this.sentMessageIds.add(message.id);
        this.scrollToBottom();
        
        if (!isSelfSent) {
          this.playNotificationSound();
          this.markMessagesAsRead(this.selectedChat.id);
        }
      }
      
      this.updateChatList(message);
      
      if (!isSelfSent && !this.isOpen) {
        this.showDesktopNotification(message);
      } else if (!isSelfSent && this.isOpen && this.selectedChat?.id !== message.chat_id) {
        this.showDesktopNotification(message);
      }
    }
    
    this.cdr.detectChanges();
  }

  private handleTypingIndicator(data: any) {
    if (this.selectedChat && this.selectedChat.id === data.chatId && data.userId !== this.currentUser?.id) {
      if (data.isTyping && !this.typingUsers.includes(data.userName)) {
        this.typingUsers.push(data.userName);
      } else if (!data.isTyping) {
        this.typingUsers = this.typingUsers.filter(user => user !== data.userName);
      }
      this.isTyping = this.typingUsers.length > 0;
      
      if (this.isTyping) {
        const timeout = setTimeout(() => {
          this.isTyping = false;
          this.typingUsers = [];
          this.cdr.detectChanges();
        }, 3000);
        this.loadingTimeouts.push(timeout);
      }
      
      this.cdr.detectChanges();
    }
  }

  private handleOnlineStatus(data: any) {
    if (data.isOnline) {
      this.onlineUsers.add(data.userId);
    } else {
      this.onlineUsers.delete(data.userId);
    }
    
    this.employees = this.employees.map(emp => {
      if (emp.user_id === data.userId || emp.id === data.userId) {
        return { ...emp, isOnline: data.isOnline };
      }
      return emp;
    });
    
    this.cdr.detectChanges();
  }

  private handleMessagesRead(data: any) {
    if (this.selectedChat && this.selectedChat.id === data.chatId) {
      this.messages.forEach(msg => {
        if (msg.sender_id !== this.currentUser?.id) {
          msg.is_read = true;
        }
      });
      this.cdr.detectChanges();
    }
  }

  // ==================== NOTIFICATION METHODS ====================

  private playNotificationSound() {
    try {
      const audio = new Audio('assets/notification.mp3');
      audio.play().catch(e => {
        console.log('Audio play failed:', e);
        this.playFallbackSound();
      });
    } catch (e) {
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
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
      
      oscillator.start();
      setTimeout(() => oscillator.stop(), 500);
    } catch (e) {
      console.log('Audio not supported');
    }
  }

  private showDesktopNotification(message: IMessage) {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      const notificationOptions: NotificationOptions = {
        body: message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content,
        icon: '/assets/chat-icon.png',
        tag: `chat-${message.chat_id}-${message.id}`,
        requireInteraction: true,
        silent: false
      };

      // Vibration support
      if ('vibrate' in navigator && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }

      const notification = new Notification(`New message from ${message.sender_name}`, notificationOptions);

      notification.onclick = () => {
        window.focus();
        this.isOpen = true;
        if (this.selectedChat?.id !== message.chat_id) {
          const chat = this.chats.find(c => c.id === message.chat_id);
          if (chat) {
            this.selectChat(chat);
          }
        }
        notification.close();
      };

      notification.onclose = () => {
        console.log('Notification closed');
      };

      setTimeout(() => notification.close(), 10000);
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          this.showDesktopNotification(message);
        }
      });
    }
  }

  // ==================== UI CONTROL METHODS ====================

  toggleChatPanel() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.loadChats();
      setTimeout(() => {
        if (this.messageTextarea) {
          this.messageTextarea.nativeElement.focus();
        }
        if (this.selectedChat) {
          this.markMessagesAsRead(this.selectedChat.id);
        }
      }, 300);
    } else {
      this.selectedChat = null;
      this.messages = [];
      this.isTyping = false;
      this.typingUsers = [];
    }
    this.toggleChat.emit();
    this.cdr.detectChanges();
  }

  closeChat() {
    this.isOpen = false;
    this.selectedChat = null;
    this.messages = [];
    this.isTyping = false;
    this.typingUsers = [];
    this.showEmployees = false; // Reset employees visibility when closing chat
    this.toggleChat.emit();
    this.cdr.detectChanges();
  }

  toggleEmployeesVisibility() {
    this.showEmployees = !this.showEmployees;
    console.log('Employees visibility toggled:', this.showEmployees);
    
    // Load employees if showing and not already loaded
    if (this.showEmployees && this.employees.length === 0 && !this.isLoadingEmployees) {
      this.loadEmployees();
    }
    
    this.cdr.detectChanges();
  }

  // ==================== CHAT METHODS ====================

  loadChats() {
    if (this.isLoadingChats) return;
    
    this.isLoadingChats = true;
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('No authentication token found');
      this.isLoadingChats = false;
      this.cdr.detectChanges();
      return;
    }
    
    const timeout = setTimeout(() => {
      this.isLoadingChats = false;
      this.cdr.detectChanges();
    }, 10000);
    
    this.loadingTimeouts.push(timeout);
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    this.http.get<IChat[]>(`${this.API_URL}/chats`, { headers }).subscribe({
      next: (chats) => {
        clearTimeout(timeout);
        this.chats = Array.isArray(chats) ? chats : [];
        this.removeDuplicateChats();
        this.sortChatsByRecent();
        this.isLoadingChats = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        clearTimeout(timeout);
        console.error('Failed to load chats:', err);
        this.showError('Failed to load chats. Please try again.');
        this.isLoadingChats = false;
        this.chats = [];
        this.cdr.detectChanges();
      }
    });
  }

  private removeDuplicateChats() {
    const uniqueChats = new Map<number, IChat>();
    this.chats.forEach(chat => {
      if (!uniqueChats.has(chat.id)) {
        uniqueChats.set(chat.id, chat);
      }
    });
    this.chats = Array.from(uniqueChats.values());
  }

  private sortChatsByRecent() {
    this.chats.sort((a, b) => {
      const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
      const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
      return timeB - timeA;
    });
  }

  selectChat(chat: IChat) {
    this.selectedChat = chat;
    this.sentMessageIds.clear();
    this.loadMessages(chat.id);
    this.markMessagesAsRead(chat.id);
    
    this.socket?.emit('join_chat', chat.id);
    
    // Auto focus on message input when chat is selected
    setTimeout(() => {
      if (this.messageTextarea) {
        this.messageTextarea.nativeElement.focus();
      }
    }, 100);
    
    this.cdr.detectChanges();
  }

  loadMessages(chatId: number) {
    this.isLoadingMessages = true;
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('No authentication token found');
      this.isLoadingMessages = false;
      this.cdr.detectChanges();
      return;
    }
    
    const timeout = setTimeout(() => {
      this.isLoadingMessages = false;
      this.cdr.detectChanges();
    }, 10000);
    
    this.loadingTimeouts.push(timeout);
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    this.http.get<IMessage[]>(`${this.API_URL}/chats/${chatId}/messages`, { headers }).subscribe({
      next: (messages) => {
        clearTimeout(timeout);
        this.messages = messages;
        this.isLoadingMessages = false;
        this.sentMessageIds.clear();
        messages.forEach(msg => this.sentMessageIds.add(msg.id));
        this.scrollToBottom();
        this.cdr.detectChanges();
      },
      error: (err) => {
        clearTimeout(timeout);
        console.error('Failed to load messages:', err);
        this.showError('Failed to load messages. Please try again.');
        this.isLoadingMessages = false;
        this.cdr.detectChanges();
      }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.selectedChat) return;

    const now = Date.now();
    if (now - this.lastMessageTime < 1000) {
      console.log('Message sending too quickly, ignoring');
      return;
    }
    this.lastMessageTime = now;

    const messageContent = this.newMessage.trim();
    this.newMessage = '';
    this.autoResizeTextarea();

    const token = localStorage.getItem('token');
    if (!token) {
      this.showError('Authentication required. Please login again.');
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.http.post<IMessage>(`${this.API_URL}/chats/${this.selectedChat.id}/messages`, {
      content: messageContent,
      message_type: 'text'
    }, { headers }).subscribe({
      next: (message) => {
        const isAlreadyAdded = this.messages.some(m => m.id === message.id);
        if (!isAlreadyAdded) {
          this.messages.push(message);
          this.sentMessageIds.add(message.id);
          this.scrollToBottom();
        }
        
        this.stopTyping();
        this.updateChatList(message);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to send message:', err);
        const errorMsg = err.error?.message || 'Failed to send message. Please try again.';
        this.showError(errorMsg);
        this.newMessage = messageContent;
        this.cdr.detectChanges();
      }
    });
  }

  // ==================== EMPLOYEE & GROUP CHAT METHODS ====================

  loadEmployees() {
    if (!this.isManager()) {
      console.log('Not a manager, skipping employee load');
      return;
    }

    this.isLoadingEmployees = true;
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('No authentication token found for loading employees');
      this.isLoadingEmployees = false;
      this.cdr.detectChanges();
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.http.get<IEmployee[]>(`${this.API_URL}/employees`, { headers }).subscribe({
      next: (employees) => {
        this.employees = employees.filter(emp => 
          emp.id !== this.currentUser?.id && 
          emp.user_id !== this.currentUser?.id
        ).map(emp => ({
          ...emp,
          isOnline: this.onlineUsers.has(emp.user_id || emp.id)
        }));
        
        this.isLoadingEmployees = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load employees:', err);
        this.isLoadingEmployees = false;
        this.cdr.detectChanges();
      }
    });
  }

  startPrivateChat(employee: IEmployee) {
    const token = localStorage.getItem('token');
    if (!token) {
      this.showError('Authentication required. Please login again.');
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.http.post<{chat_id: number; chat: IChat}>(`${this.API_URL}/chats/private`, {
      other_user_id: employee.user_id || employee.id
    }, { headers }).subscribe({
      next: (response) => {
        this.showSuccess('Chat started successfully');
        this.loadChats();
        
        // Hide employees list after starting chat
        this.showEmployees = false;
        
        const timeout = setTimeout(() => {
          const foundChat = this.chats.find(c => c.id === response.chat_id);
          if (foundChat) {
            this.selectChat(foundChat);
          } else if (response.chat) {
            this.selectChat(response.chat);
          }
          this.cdr.detectChanges();
        }, 500);
        this.loadingTimeouts.push(timeout);
      },
      error: (err) => {
        console.error('Failed to start private chat:', err);
        const errorMsg = err.error?.message || 'Failed to start chat. Please try again.';
        this.showError(errorMsg);
      }
    });
  }

  createGroupChat() {
    if (!this.groupName.trim() || this.selectedEmployees.length === 0) {
      this.showError('Please enter group name and select at least one employee');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      this.showError('Authentication required. Please login again.');
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const selectedUserIds = this.selectedEmployees.map(empId => {
      const employee = this.employees.find(e => e.id === empId);
      return employee?.user_id || empId;
    });

    this.http.post<{chat_id: number; message: string; chat: IChat}>(`${this.API_URL}/chats/group`, {
      name: this.groupName.trim(),
      participant_ids: selectedUserIds
    }, { headers }).subscribe({
      next: (response) => {
        this.showSuccess(response.message);
        this.showGroupCreation = false;
        this.groupName = '';
        this.selectedEmployees = [];
        this.loadChats();
        
        // Hide employees list after creating group
        this.showEmployees = false;
        
        const timeout = setTimeout(() => {
          const foundChat = this.chats.find(c => c.name === this.groupName.trim());
          if (foundChat) {
            this.selectChat(foundChat);
          } else if (response.chat) {
            this.selectChat(response.chat);
          }
        }, 1000);
        this.loadingTimeouts.push(timeout);
        this.cdr.detectChanges();
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
    this.cdr.detectChanges();
  }

  // ==================== TYPING INDICATORS ====================

  onTyping() {
    if (this.selectedChat) {
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }

      this.socket?.emit('typing', {
        chatId: this.selectedChat.id,
        isTyping: true,
        userName: this.currentUser?.name,
        userId: this.currentUser?.id
      });

      this.typingTimeout = setTimeout(() => {
        this.stopTyping();
      }, 2000);
    }
  }

  private stopTyping() {
    if (this.selectedChat) {
      this.socket?.emit('typing', {
        chatId: this.selectedChat.id,
        isTyping: false,
        userName: this.currentUser?.name,
        userId: this.currentUser?.id
      });
    }
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }

  onInputChange() {
    this.onTyping();
    this.autoResizeTextarea();
  }

  // ==================== MESSAGE MANAGEMENT ====================

  markMessagesAsRead(chatId: number) {
    const token = localStorage.getItem('token');
    if (!token) return;

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.http.put(`${this.API_URL}/chats/${chatId}/mark-read`, {}, { headers }).subscribe({
      next: () => {
        const chatIndex = this.chats.findIndex(c => c.id === chatId);
        if (chatIndex > -1) {
          this.chats[chatIndex].unread_count = 0;
        }
        
        this.messages.forEach(msg => {
          if (msg.sender_id !== this.currentUser?.id) {
            msg.is_read = true;
          }
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to mark messages as read:', err);
      }
    });
  }

  updateChatList(message: IMessage) {
    const chatIndex = this.chats.findIndex(c => c.id === message.chat_id);
    
    if (chatIndex > -1) {
      const chat = this.chats[chatIndex];
      chat.last_message = message.content.length > 30 
        ? message.content.substring(0, 30) + '...' 
        : message.content;
      chat.last_message_time = message.created_at;
      
      const isSelfMessage = message.sender_id === this.currentUser?.id;
      const isChatSelected = this.selectedChat?.id === message.chat_id;
      
      if (!isSelfMessage && !isChatSelected) {
        chat.unread_count += 1;
      } else if (isChatSelected) {
        chat.unread_count = 0;
      }
      
      this.chats.splice(chatIndex, 1);
      this.chats.unshift(chat);
    } else {
      this.loadChats();
    }
    
    this.cdr.detectChanges();
  }

  // ==================== HELPER METHODS ====================

  backToChats() {
    if (this.selectedChat) {
      this.socket?.emit('leave_chat', this.selectedChat.id);
      this.stopTyping();
    }
    
    this.selectedChat = null;
    this.messages = [];
    this.isTyping = false;
    this.typingUsers = [];
    this.loadChats();
    this.cdr.detectChanges();
  }

  startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      if (this.isOpen && !this.isLoadingChats && !this.isLoadingMessages) {
        if (this.selectedChat) {
          this.loadMessages(this.selectedChat.id);
        } else {
          this.loadChats();
        }
      }
      
      // Auto-refresh online status
      if (this.isManager() && this.showEmployees) {
        this.updateOnlineStatus();
      }
    }, 30000);
  }

  private updateOnlineStatus() {
    // Update online status for employees
    this.employees = this.employees.map(emp => ({
      ...emp,
      isOnline: this.onlineUsers.has(emp.user_id || emp.id)
    }));
    this.cdr.detectChanges();
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer && this.messagesContainer.nativeElement) {
        const container = this.messagesContainer.nativeElement;
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  formatTime(dateString: string | undefined): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      const diffInHours = Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);
      
      if (diffInMinutes < 1) {
        return 'Just now';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
      } else if (diffInHours < 24) {
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
      } else if (diffInDays === 1) {
        return 'Yesterday';
      } else if (diffInDays < 7) {
        return date.toLocaleDateString('en-US', { 
          weekday: 'short'
        });
      } else {
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        });
      }
    } catch {
      return '';
    }
  }

  isManager(): boolean {
    return this.currentUser?.role === 'manager' || this.currentUser?.role === 'admin';
  }

  isUserOnline(userId: number): boolean {
    return this.onlineUsers.has(userId);
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  isChatSelected(chat: IChat): boolean {
    return this.selectedChat !== null && this.selectedChat.id === chat.id;
  }

  private showSuccess(message: string) {
    console.log('Success:', message);
    // You can add toast notification here
  }

  private showError(message: string) {
    console.error('Error:', message);
    // You can add toast notification here
  }

  autoResizeTextarea() {
    setTimeout(() => {
      if (this.messageTextarea) {
        const textarea = this.messageTextarea.nativeElement;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      }
    }, 0);
  }

  @HostListener('window:focus')
  onWindowFocus() {
    if (this.selectedChat) {
      this.markMessagesAsRead(this.selectedChat.id);
    }
  }

  shouldShowChat(): boolean {
    return !!this.currentUser;
  }

  handleChatSelection(chat: IChat) {
    if (this.isChatSelected(chat)) {
      this.backToChats();
    } else {
      this.selectChat(chat);
    }
  }

  getTotalUnreadCount(): number {
    const total = this.chats.reduce((total, chat) => {
      const count = Number(chat.unread_count) || 0;
      return total + count;
    }, 0);
    return total;
  }

  formatUnreadCount(count: number): string {
    if (count <= 0) return '';
    return count > 99 ? '99+' : count.toString();
  }

  // ==================== SEARCH FUNCTIONALITY ====================

  onEmployeeSearchChange() {
    // Debounce search for better performance
    if (this.messageDebounceTimeout) {
      clearTimeout(this.messageDebounceTimeout);
    }
    
    this.messageDebounceTimeout = setTimeout(() => {
      this.cdr.detectChanges();
    }, 300);
  }

  clearEmployeeSearch() {
    this.employeeSearch = '';
    this.cdr.detectChanges();
  }

  // ==================== MOBILE RESPONSIVE HANDLING ====================

  @HostListener('window:resize')
  onResize() {
    // Hide employees panel on small screens when chat is open
    if (window.innerWidth < 768 && this.isOpen && this.showEmployees) {
      this.showEmployees = false;
    }
  }
}