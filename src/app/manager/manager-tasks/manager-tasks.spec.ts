import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagerTasksComponent } from './manager-tasks';

describe('ManagerTasks', () => {
  let component: ManagerTasksComponent;
  let fixture: ComponentFixture<ManagerTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerTasksComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManagerTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
