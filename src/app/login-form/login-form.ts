import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [FormsModule, CommonModule, HttpClientModule],
  templateUrl: './login-form.html',
  styleUrl: './login-form.scss'
})
export class LoginForm {
  inputType = 'password';
  iconClass = 'ri-eye-off-fill';
  
  errorMessage = '';
  isLoading = false;
  email = '';
  password = '';

  private readonly API_URL = this.getApiUrl();

  constructor(private http: HttpClient, private router: Router) { }

  private getApiUrl(): string {
    const currentUrl = window.location.href;
    if (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
      return 'http://localhost:3000/api';
    } else {
      return 'https://xtro-edge-task-manager-backend.vercel.app/api';
    }
  }

  togglePassword() {
    this.inputType = this.inputType === 'password' ? 'text' : 'password';
    this.iconClass = this.inputType === 'password' ? 'ri-eye-off-fill' : 'ri-eye-fill';
  }

  clearForm() {
    this.email = '';
    this.password = '';
    this.errorMessage = '';
  }

  onLogin(form: any) {
    if (!form.valid) {
      this.errorMessage = 'Please fill all required fields';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // console.log('Login attempt with:', form.value);

    const loginData = {
      email: form.value.email,
      password: form.value.password
    };

    // console.log('Sending login data:', loginData);

    this.http.post(`${this.API_URL}/login`, loginData).subscribe({
      next: (res: any) => {
        // console.log("✅ Login Success:", res);
        this.isLoading = false;

        // Store token and user data
        localStorage.setItem("token", res.token);
        localStorage.setItem("user", JSON.stringify(res.user));
        localStorage.setItem("userId", res.user.id.toString());
        localStorage.setItem("userEmail", res.user.email);
        localStorage.setItem("userName", res.user.name);
        localStorage.setItem("userRole", res.user.role);
        
        // console.log("User data stored:", res.user);

        // Redirect based on role
        if (res.user.role === 'manager') {
          this.router.navigate(['/manager-tasks']);
        } else {
          this.router.navigate(['/tasks']);
        }
      },
      error: (err) => {
        console.error("❌ Login Failed:", err);
        this.isLoading = false;
        
        // Better error handling
        if (err.status === 400) {
          this.errorMessage = 'Invalid email or password format';
        } else if (err.status === 401) {
          this.errorMessage = 'Invalid credentials';
        } else if (err.status === 0) {
          this.errorMessage = 'Cannot connect to server. Please make sure backend is running.';
        } else {
          this.errorMessage = err.error?.error || 'Login failed. Please try again.';
        }
        
        console.log('Error details:', err);
      }
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