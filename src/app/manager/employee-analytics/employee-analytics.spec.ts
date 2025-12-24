import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmployeeAnalytics } from './employee-analytics';

describe('EmployeeAnalytics', () => {
  let component: EmployeeAnalytics;
  let fixture: ComponentFixture<EmployeeAnalytics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeAnalytics]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmployeeAnalytics);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
