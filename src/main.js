import './style.css';
import { supabase } from './supabaseClient.js';

const $ = (id) => document.getElementById(id);

let students = [];
let courses = [];
let departments = [];
let accessReady = false;
let sessionVersion = 0;

function message(text) {
  $('message').textContent = text;
}

function clearForm() {
  $('student-form').reset();
  $('student-id').value = '';
}

function showApp(session) {
  accessReady = !!session;
  $('app').hidden = !accessReady;
  $('login').hidden = accessReady;

  $('signed-in').textContent = session
    ? `Signed in as ${session.user.email}`
    : '';

  $('auth-message').textContent = session
    ? ''
    : 'Sign in to continue.';
}

function renderDepartments() {
  $('department-list').replaceChildren();

  for (const d of departments) {
    const li = document.createElement('li');
    li.textContent = d.department_name ?? 'Unnamed department';
    $('department-list').append(li);
  }

  if (!departments.length) {
    $('department-list').textContent = 'No departments found.';
  }
}

function renderStudents() {
  const term = $('search').value.trim().toLowerCase();

  $('student-list').replaceChildren();

  const visible = students.filter((s) =>
    `${s.student_no ?? ''} ${s.first_name ?? ''} ${s.last_name ?? ''}`
      .toLowerCase()
      .includes(term)
  );

  if (!visible.length) {
    const li = document.createElement('li');
    li.textContent = 'No matching records.';
    $('student-list').append(li);
  }

  for (const s of visible) {
    const course = courses.find(
      (c) => String(c.course_id) === String(s.course_id)
    );

    const department = departments.find(
      (d) => String(d.department_id) === String(course?.department_id)
    );

    const li = document.createElement('li');
    const details = document.createElement('span');

    details.textContent =
      `${s.student_no ?? 'No student number'} | ` +
      `${s.first_name ?? ''} ${s.last_name ?? ''} | ` +
      `Year ${s.year_level ?? 'N/A'} | ${s.email} | ` +
      `${course?.course_code ?? s.course ?? 'No course'} | ` +
      `${department?.department_name ?? course?.department ?? 'No department'}`;

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';

    edit.onclick = () => {
      $('student-id').value = s.id;
      $('student-no').value = s.student_no ?? '';
      $('first-name').value = s.first_name ?? '';
      $('last-name').value = s.last_name ?? '';
      $('year').value = s.year_level ?? '';
      $('student-email').value = s.email;
      $('course').value = s.course_id ?? '';
      message('Editing student record.');
    };

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete';

    remove.onclick = async () => {
      if (!confirm(`Delete student ${s.student_no ?? s.email}?`)) return;

      const { data, error } = await supabase
        .from('students')
        .delete()
        .eq('id', s.id)
        .select('id');

      if (error) {
        message(error.message);
        return;
      }

      if (!data?.length) {
        message('Nothing deleted. Check account permissions.');
        return;
      }

      await load();
      message('Student deleted successfully.');
    };

    li.append(details, edit, remove);
    $('student-list').append(li);
  }
}

function fillCourseOptions() {
  const selectedCourse = $('course').value;
  const selectedReportCourse = $('report-course').value;

  $('course').replaceChildren(new Option('Choose a course', ''));
  $('report-course').replaceChildren(new Option('Choose a course', ''));

  for (const c of courses) {
    const label = `${c.course_code ?? 'No code'} - ${c.course_name ?? ''}`;

    $('course').add(new Option(label, c.course_id));
    $('report-course').add(new Option(label, c.course_id));
  }

  $('course').value = selectedCourse;
  $('report-course').value = selectedReportCourse;
}

async function load() {
  const version = sessionVersion;

  const results = await Promise.all([
    supabase.from('students').select('*').order('last_name'),
    supabase.from('course').select('*').order('course_code'),
    supabase.from('departments').select('*').order('department_name')
  ]);

  if (version !== sessionVersion || !accessReady) return;

  const error = results.find((r) => r.error)?.error;

  if (error) {
    message(error.message);
    return;
  }

  students = results[0].data ?? [];
  courses = results[1].data ?? [];
  departments = results[2].data ?? [];

  fillCourseOptions();
  renderStudents();
  renderDepartments();

  message(`${students.length} student record(s) loaded.`);
}

async function checkSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    $('auth-message').textContent = error.message;
    return;
  }

  showApp(data.session);

  if (data.session) {
    sessionVersion++;
    await load();
  }
}

$('login').onsubmit = async (event) => {
  event.preventDefault();

  $('auth-message').textContent = 'Signing in...';

  const { data, error } = await supabase.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value
  });

  if (error) {
    $('auth-message').textContent = error.message;
    return;
  }

  $('password').value = '';

  showApp(data.session);
  sessionVersion++;

  await load();
};

$('logout').onclick = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    $('auth-message').textContent = error.message;
    return;
  }

  sessionVersion++;
  students = [];
  courses = [];
  departments = [];

  $('student-list').replaceChildren();
  $('department-list').replaceChildren();
  $('report').textContent = '';

  clearForm();
  showApp(null);
};

$('student-form').onsubmit = async (event) => {
  event.preventDefault();

  if (!accessReady) {
    message('Please sign in first.');
    return;
  }

  const selectedCourse = courses.find(
    (c) => String(c.course_id) === $('course').value
  );

  if (!selectedCourse) {
    message('Please choose a valid course.');
    return;
  }

  const yearValue = $('year').value;

  const record = {
    student_no: $('student-no').value.trim() || null,
    first_name: $('first-name').value.trim() || null,
    last_name: $('last-name').value.trim() || null,
    course: selectedCourse.course_code,
    year_level: yearValue ? Number(yearValue) : null,
    email: $('student-email').value.trim(),
    course_id: selectedCourse.course_id
  };

  if (
    !record.email ||
    (record.year_level !== null &&
      (!Number.isInteger(record.year_level) ||
       record.year_level < 1 ||
       record.year_level > 4))
  ) {
    message('Enter a valid email and year level from 1 to 4.');
    return;
  }

  const id = $('student-id').value;

  const query = id
    ? supabase.from('students').update(record).eq('id', id)
    : supabase.from('students').insert(record);

  const { data, error } = await query.select('id');

  if (error) {
    message(error.message);
    return;
  }

  if (!data?.length) {
    message('Nothing saved. Check account permissions.');
    return;
  }

  clearForm();
  await load();
  message('Student saved successfully.');
};

$('clear').onclick = () => {
  clearForm();
  message('Form cleared.');
};

$('refresh').onclick = () => load();
$('search').oninput = renderStudents;

$('count').onclick = async () => {
  const courseId = $('report-course').value;

  if (!courseId) {
    $('report').textContent = 'Choose a course first.';
    return;
  }

  const selected = courses.find(
    (c) => String(c.course_id) === courseId
  );

  const { count, error } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId);

  $('report').textContent = error
    ? error.message
    : `Total students in ${selected?.course_code ?? 'this course'}: ${count}`;
};

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    sessionVersion++;
    students = [];
    courses = [];
    departments = [];
    $('student-list').replaceChildren();
    $('department-list').replaceChildren();
    clearForm();
    showApp(null);
  }
});

checkSession().catch((error) => {
  $('auth-message').textContent = error.message;
});