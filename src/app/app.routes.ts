// import { Routes } from '@angular/router';
// import { AuthGuard, RoleGuard } from './guards/auth.guard';


// export const routes: Routes = [
//   { path: '', redirectTo: '/login', pathMatch: 'full' },
//   { path: 'login', loadComponent: () => import('./login-form/login-form').then(m => m.LoginForm) },
//   { path: 'register', loadComponent: () => import('./register/register/register').then(m => m.RegisterComponent) },
//   { 
//     path: 'dashboard', 
//     loadComponent: () => import('./dashboard/dashboard').then(m => m.DashboardComponent),
//     canActivate: [AuthGuard]
//   },
//   { 
//     path: 'tasks', 
//     loadComponent: () => import('./manager/task-manager/task-manager').then(m => m.TaskManagerComponent),
//     canActivate: [AuthGuard]
//   },
//   { 
//     path: 'calendar', 
//     loadComponent: () => import('./calender-date/calendar.component').then(m => m.CalendarComponent),
//     canActivate: [AuthGuard]
//   },
//   { 
//     path: 'employee-analytics', 
//     loadComponent: () => import('./manager/employee-analytics/employee-analytics').then(m => m.EmployeeAnalyticsComponent),
//     canActivate: [RoleGuard],
//     data: { role: 'manager' }
//   },
//   { 
//     path: 'manager-tasks', 
//     loadComponent: () => import('./manager/manager-tasks/manager-tasks').then(m => m.ManagerTasksComponent),
//     canActivate: [RoleGuard],
//     data: { role: 'manager' }
//   },
//   { 
//     path: 'progress', 
//     loadComponent: () => import('./progress/progress').then(m => m.Progress),
//     canActivate: [RoleGuard],
//     data: { role: 'manager' }
//   },
//   { 
//     path: 'progress', 
//     loadComponent: () => import('./chat/chat').then(m => m.Chat),
//     canActivate: [AuthGuard],
//     data: { role: 'manager' }
//   }
// ];






// routes.ts - Updated
import { Routes } from '@angular/router';
import { AuthGuard, RoleGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./login-form/login-form').then(m => m.LoginForm) },
  { path: 'register', loadComponent: () => import('./register/register/register').then(m => m.RegisterComponent) },
  { 
    path: 'dashboard', 
    loadComponent: () => import('./dashboard/dashboard').then(m => m.DashboardComponent),
    canActivate: [AuthGuard]
  },
  { 
    path: 'tasks', 
    loadComponent: () => import('./manager/task-manager/task-manager').then(m => m.TaskManagerComponent),
    canActivate: [AuthGuard]
  },
  { 
    path: 'calendar', 
    loadComponent: () => import('./calender-date/calendar.component').then(m => m.CalendarComponent),
    canActivate: [AuthGuard]
  },
  { 
    path: 'employee-analytics', 
    loadComponent: () => import('./manager/employee-analytics/employee-analytics').then(m => m.EmployeeAnalyticsComponent),
    canActivate: [RoleGuard],
    data: { role: 'manager' }
  },
  { 
    path: 'manager-tasks', 
    loadComponent: () => import('./manager/manager-tasks/manager-tasks').then(m => m.ManagerTasksComponent),
    canActivate: [RoleGuard],
    data: { role: 'manager' }
  },
  { 
    path: 'progress', 
    loadComponent: () => import('./progress/progress').then(m => m.Progress),
    canActivate: [RoleGuard],
    data: { role: 'manager' }
  },
  { 
    path: 'chat', 
    loadComponent: () => import('./chat/chat').then(m => m.Chat),
    canActivate: [AuthGuard]
  }
];