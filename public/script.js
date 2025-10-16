const apiBaseUrl = window.location.origin;

const displayData = (elementId, payload) => {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  element.textContent = JSON.stringify(payload, null, 2);
};

const displayError = (elementId, error) => {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  element.textContent = `Failed to load: ${error.message}`;
  element.classList.add('error');
};

const fetchJson = async (path) => {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

const loadUsersAndEvents = async () => {
  try {
    const [users, events] = await Promise.all([
      fetchJson('/users'),
      fetchJson('/events'),
    ]);
    displayData('usersData', users);
    displayData('eventsData', events);
  } catch (error) {
    displayError('usersData', error);
    displayError('eventsData', error);
  }
};

window.addEventListener('DOMContentLoaded', loadUsersAndEvents);
