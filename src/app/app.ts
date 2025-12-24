import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Chat } from "./chat/chat";
import { CommonModule } from '@angular/common';
// import { Todo } from "./todo/todo";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Chat , CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('task-manager');
  //   constructor(
  //     private router: Router,
  //   ) {}
  // chat() {
  //   this.router.navigate(['/chat']);
  // }
    currentUser: any = null;
  isManager: boolean = false;
  
  constructor() {}
  
  ngOnInit() {
    // Get user data from localStorage
    this.loadUserData();
    
    // Listen for login/logout events
    window.addEventListener('storage', (event) => {
      if (event.key === 'user') {
        this.loadUserData();
      }
    });
  }
  
  loadUserData() {
    const userData = localStorage.getItem('user');
    if (userData) {
      this.currentUser = JSON.parse(userData);
      this.isManager = this.currentUser?.role === 'manager';
    } else {
      this.currentUser = null;
      this.isManager = false;
    }
  }
  
  // Agar login/logout events handle karne hain to
  onLogin() {
    this.loadUserData();
  }
  
  onLogout() {
    this.currentUser = null;
    this.isManager = false;
  }
}
