import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router, RouterLink, RouterModule } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule,RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class RegisterComponent {
  registerData = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'employee'
  };
  
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  private readonly API_URL = this.getApiUrl();

  private getApiUrl(): string {
    const currentUrl = window.location.href;
    if (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
      return 'http://localhost:3000/api';
    } else {
      return 'https://xtro-edge-task-manager-backend.vercel.app/api';
    }
  }

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  onRegister() {
    // Validation
    if (!this.registerData.name || !this.registerData.email || !this.registerData.password) {
      this.errorMessage = 'All fields are required';
      return;
    }

    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    if (this.registerData.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { confirmPassword, ...registerPayload } = this.registerData;

    // this.http.post<any>(`${this.API_URL}/register`, registerPayload)
    this.http.post<any>(`${this.API_URL}/employees`, registerPayload)
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.successMessage = 'Registration successful! Redirecting to login...';
          
          // Auto redirect to login after 2 seconds
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.error || 'Registration failed. Please try again.';
          console.error('Registration error:', err);
        }
      });
  }

  clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }
}