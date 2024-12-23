const DEFAULT_EMPLOYEES = [
    { name: 'Andrea Jesse', team: 'Admin', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Adam Minor', team: 'IT', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Andrea Scheid', team: 'Admin', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Chad Bulkowski', team: 'IT', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Chris Sanders', team: 'IT', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Dan Hinds', team: 'BPA', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Dawn Whitney', team: 'Admin', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Gabriel Scheid', team: 'BPA', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Jillian Wojtczak', team: 'Admin', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Mitchell Milligan', team: 'IT', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Mike Ritt', team: 'BPA', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Natanyahu Dunn', team: 'IT', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Nate Osmanski', team: 'IT', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Ray Schweissinger', team: 'IT', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Taylor Gutzmann', team: 'IT', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Tom Paul', team: 'Admin', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Tom Wielenbeck', team: 'BPA', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
    { name: 'Zach Oxley', team: 'IT', progress: 0, performanceProgress: 0, goal1: '', goal2: '', goal3: '' },
];

const EXCLUDED_EMPLOYEES = [
    'Vicki Hirschfeld',
    'Scott Hirschfeld',
    'Andrea Scheid',
    'Cassidy Williams'
];

// This function is to make an API call to Laserfiche in order to get all users from the Employee_Manager lookup table so that we only need to
// Update that table when we get a new employee. That being said, Laserfiche's API does not trust localhost for its table api, only the repository api,
// So I have a list of employees here as a fallback for local development and/or as a save for if the api doesn't call. But this shouldnt need to be 
// updated regularly - testing
async function fetchEmployees(accessToken) {
    const employeeUrl = 'https://api.laserfiche.com/odata4/table/Employee_Manager';

    try {
        const response = await fetch(employeeUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'same-origin'
        });

        if (!response.ok) {
            if (response.status === 401) {
                const newToken = await refreshToken();
                if (newToken) {
                    return fetchEmployees(newToken);
                }
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Filter out excluded employees and transform the data
        return data.value
            .filter(employee => !excludedEmployees.includes(employee.EmployeeName))
            .map(employee => ({
                name: employee.EmployeeName,
                team: employee.Team.replace(' Team', ''),
                progress: 0,
                performanceProgress: 0,
                goal1: '',
                goal2: '',
                goal3: ''
            }));
    } catch (error) {
        // console.error('Error fetching employees:', error);
        // Return filtered default employee list
        return DEFAULT_EMPLOYEES.filter(employee => !EXCLUDED_EMPLOYEES.includes(employee.name));
    }
}

function parseQueryString(query) {
    return query
        ? Object.fromEntries(query.split('&').map(pair => pair.split('=')))
        : {};
}

window.addEventListener('load', function () {
    const queryParams = parseQueryString(window.location.search.slice(1));
    const code = queryParams.code;
    const returnedState = queryParams.state;
    const storedState = sessionStorage.getItem('oauth_state');
    const accessToken = sessionStorage.getItem('access_token');

    if (code && returnedState === storedState) {
        exchangeCodeForTokens(code);
    } else if (accessToken) {
        fetchTeamsAndQuarters(accessToken);
    } else {
        initiateLogin();
    }
});

// Redirect uri should always be the github link unless you're working on things locally.
//
// User has to sign into laserfiche for this web app to pull their respective rights from our CTaccess repository
// EX. The IT Manager, who does not have laserfiche repository access to the BPA team files, would not be able to see
// BPA member goals or progress on here.

function initiateLogin() {
    const clientId = 'b493f960-3a0e-4a02-89f7-b09b9db97a1c';
    const redirectUri = 'https://dhindsctaccess.github.io/SMART_Dashboard/index.html';
    //const redirectUri = 'http://127.0.0.1:5501/index.html';
    const customerId = '961460947';
    const scope = 'repository.Read table.Read';
    const state = generateRandomState(16);

    sessionStorage.setItem('oauth_state', state);

    const authUrl = `https://signin.laserfiche.com/oauth/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&customerId=${customerId}&scope=${encodeURIComponent(scope)}`;

    window.location.href = authUrl;
}

// Function to generate random state for CSRF protection
function generateRandomState(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let state = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        state += characters[randomIndex];
    }
    return state;
}

// Check if code and state are returned in URL after redirect
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const returnedState = urlParams.get('state');
const storedState = sessionStorage.getItem('oauth_state');

// Handle authentication response
if (code && returnedState === storedState) {
    exchangeCodeForTokens(code);
} else if (returnedState !== storedState) {
    console.error('State does not match. Possible CSRF attack.');
} else {
    const accessToken = sessionStorage.getItem('access_token');
    if (accessToken) {
        fetchTeamsAndQuarters(accessToken);
    } else {
        // Only initiate login if we don't have an access token
        initiateLogin();
    }
}

// Function to exchange code for access and refresh tokens
function exchangeCodeForTokens(code) {

    // clientID and clientSecret can be found in the laserfiche developer console under the application "SMART Dashboard" and then
    // under Authentication. That is also where you set rights, as well as redirect URIs

    const clientId = 'b493f960-3a0e-4a02-89f7-b09b9db97a1c';
    const clientSecret = 'CMoi3M0DVjzOCsXkZGmRg1A2QAyhNpo8IhKU3mafqFVFcUxp';
    //const redirectUri = 'http://127.0.0.1:5501/index.html';
    const redirectUri = 'https://dhindsctaccess.github.io/SMART_Dashboard/index.html';

    const tokenUrl = 'https://signin.laserfiche.com/oauth/token';
    const auth = btoa(`${clientId}:${clientSecret}`);

    const data = new URLSearchParams();
    data.append('grant_type', 'authorization_code');
    data.append('code', code);
    data.append('redirect_uri', redirectUri);

    fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: data
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to retrieve tokens');
            }
            return response.json();
        })
        .then(tokenData => {
            sessionStorage.setItem('access_token', tokenData.access_token);
            sessionStorage.setItem('refresh_token', tokenData.refresh_token);
            // Clear the URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
            fetchTeamsAndQuarters(tokenData.access_token);
        })
        .catch(error => console.error('Error fetching access token:', error));
}

// Function to fetch teams and quarters from the API
async function fetchTeamsAndQuarters(accessToken) {
    const repositoryId = 'r-618b7d56';
    const searchUrl = `https://api.laserfiche.com/repository/v2/Repositories/${repositoryId}/SimpleSearches?fields=Team&fields=Quarter&formatFieldValues=false`;

    // This uses Laserfiche search syntax
    const searchData = {
        searchCommand: '{[SMART Goals]:[Quarter]="*"} & {[SMART Goals]:[Team]="*"}'
    };

    try {
        // Try to fetch employees
        let employeeData;
        try {
            employeeData = await fetchEmployees(accessToken);
            sessionStorage.setItem('employees', JSON.stringify(employeeData));
        } catch (error) {
            console.error('Error fetching employees:', error);
            // Use default employee list from centralized array
            sessionStorage.setItem('employees', JSON.stringify(DEFAULT_EMPLOYEES));
        }

        const response = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(searchData)
        });

        if (response.ok) {
            const searchResults = await response.json();
            populateDropdowns(searchResults);
            if (window.location.pathname.includes('second-page.html')) {
                fetchEmployeeGoals(accessToken);
            } else {
                performSearch(accessToken);
            }
        } else {
            console.error('Error fetching teams and quarters:', response.status, response.statusText);
            // alert('Failed to fetch teams and quarters.');
        }
    } catch (error) {
        console.error('Error in fetchTeamsAndQuarters:', error.message);
        // alert('Failed to fetch data.');
    }

    updateTeamSelectOptions();
}

function getEmployees() {
    const employeesData = sessionStorage.getItem('employees');
    if (employeesData) {
        const employees = JSON.parse(employeesData);
        return employees.filter(employee => !EXCLUDED_EMPLOYEES.includes(employee.name));
    }
    // Return filtered default employee list
    return DEFAULT_EMPLOYEES.filter(employee => !EXCLUDED_EMPLOYEES.includes(employee.name));
}

// Function to populate team and quarter dropdowns
function populateDropdowns(searchResults) {
    const quarterSelect = document.getElementById('quarter-select');
    const quarters = new Set();

    searchResults.value.forEach(result => {
        const quarter = result.fields.find(field => field.name === 'Quarter').values[0];
        quarters.add(quarter);
    });

    // Clear existing options
    quarterSelect.innerHTML = '';

    // Add quarters in descending order
    [...quarters].sort((a, b) => new Date(b) - new Date(a)).forEach(quarter => {
        const option = document.createElement('option');
        option.value = quarter;
        option.textContent = quarter;
        quarterSelect.appendChild(option);
    });

    // Select the most recent quarter as default
    if (quarterSelect.options.length > 0) {
        quarterSelect.selectedIndex = 0;
    }
}

// Function to select the most recent quarter as default
function selectMostRecentQuarter(quarters) {
    const quarterSelect = document.getElementById('quarter-select');

    // Convert quarters to array and sort descending
    const sortedQuarters = [...quarters].sort((a, b) => new Date(b) - new Date(a));

    if (sortedQuarters.length > 0) {
        quarterSelect.value = sortedQuarters[0];
    }
}

// Function to perform search with access token
async function performSearch(accessToken) {
    const repositoryId = 'r-618b7d56';  // Replace with your repository ID
    const team = document.getElementById('team-select').value;
    const quarter = document.getElementById('quarter-select').value;

    let searchCommand = '';
    if (team === 'all' && quarter === 'all') {
        searchCommand = '{[SMART Goals]:[Quarter]="*"}';
    } else if (team === 'all') {
        searchCommand = `{[SMART Goals]:[Quarter]="${quarter}"}`;
    } else if (quarter === 'all') {
        searchCommand = `{[SMART Goals]:[Team]="${team} Team"}`;
    } else {
        searchCommand = `{[SMART Goals]:[Quarter]="${quarter}"} & {[SMART Goals]:[Team]="${team} Team"}`;
    }

    //const searchUrl = `https://api.laserfiche.com/repository/v2/Repositories/${repositoryId}/SimpleSearches?fields=Name&fields=Team&fields=Quarter&fields=Progress&fields=id&fields=pid&formatFieldValues=false`;
    const searchUrl = `https://api.laserfiche.com/repository/v2/Repositories/${repositoryId}/SimpleSearches?fields=Name&fields=Team&fields=Quarter&fields=Progress&fields=Performanceprogress&fields=id&fields=pid&formatFieldValues=false`;

    const searchData = {
        searchCommand: searchCommand
    };

    try {
        const response = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(searchData)
        });

        if (response.ok) {
            const searchResults = await response.json();
            console.log('Search results:', searchResults); // Add logging
            displaySearchResults(searchResults, team, quarter);
        } else if (response.status === 401) {
            // Token expired, refresh it
            refreshToken();
        } else {
            console.error('Error performing search:', response.status, response.statusText);
            alert('Failed to perform search.');
        }
    } catch (error) {
        console.error('Error performing search:', error.message);
        // alert('Failed to perform search.');
    }
}

function getPerformanceStatusText(progress) {
    if (progress === 0) return 'Waiting';
    if (progress === 50) return 'Sent';
    if (progress === 100) return 'Completed';
    return 'Waiting';
}

function getPerformanceStatusClass(progress) {
    const statusMap = {
        0: 'status-waiting',
        50: 'status-sent',
        100: 'status-completed'
    };
    return statusMap[progress] || 'status-waiting';
}

function getEmployeeCountsByStep(employees, searchResultsMap, selectedTeam) {
    const counts = {
        0: 0,    // Set Goals
        25: 0,   // Leader Review
        50: 0,   // Rework Goals
        75: 0,   // Leader Additional Review
        100: 0   // Goals Set!
    };

    employees.forEach(employee => {
        if (selectedTeam === 'all' || employee.team === selectedTeam) {
            const result = searchResultsMap.get(employee.name + '-' + document.getElementById('quarter-select').value);
            const progress = result ? parseFloat(result.progress) : 0;
            counts[progress] = (counts[progress] || 0) + 1;
        }
    });

    return counts;
}

function initializeTabs(counts) {
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'status-tabs';

    // COLOR FOR TABS IS CHANGED HERE
    const steps = [
        { name: 'Set Goals', progress: 0, color: '#3498db' },
        { name: 'Leader Review', progress: 25, color: '#fcad53' },
        { name: 'Rework Goals', progress: 50, color: '#FFD300' },
        { name: 'Leader Addition Review', progress: 75, color: '#9edb6c' },
        { name: 'Goals Set', progress: 100, color: '#27ae60' }
    ];

    // Add "All" tab
    const allTab = document.createElement('button');
    allTab.className = 'status-tab active';
    const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
    allTab.innerHTML = `
        <span class="count">${totalCount}</span>
        <span class="label">All</span>
    `;
    allTab.onclick = () => filterByStep('all');
    tabsContainer.appendChild(allTab);

    // Add step tabs
    steps.forEach(step => {
        const tab = document.createElement('button');
        tab.className = 'status-tab';
        tab.style.setProperty('--tab-color', step.color);
        tab.innerHTML = `
            <span class="count">${counts[step.progress] || 0}</span>
            <span class="label">${step.name}</span>
        `;
        tab.onclick = () => filterByStep(step.progress);
        tabsContainer.appendChild(tab);
    });

    // Insert tabs before the progress container
    const progressContainer = document.getElementById('progress-container');
    progressContainer.parentNode.insertBefore(tabsContainer, progressContainer);
}


function filterByStep(stepProgress) {
    // Update active tab
    const tabs = document.querySelectorAll('.status-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // Filter progress items
    const items = document.querySelectorAll('.progress-item');
    items.forEach(item => {
        const progress = parseInt(item.getAttribute('data-progress'));
        if (stepProgress === 'all' || progress === stepProgress) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function getStatusTextFromProgress(progress) {
    if (progress === 0) return 'Set Goals';
    if (progress === 25) return 'Leader Review';
    if (progress === 50) return 'Rework Goals';
    if (progress === 75) return 'Leader Additional Review';
    if (progress === 100) return 'Goals Set!';
    return 'Unknown';
}

function getStatusClassFromProgress(progress) {
    const statusMap = {
        0: 'status-set-goals',
        25: 'status-leader-review',
        50: 'status-rework-goals',
        75: 'status-additional-review',
        100: 'status-goals-set'
    };
    return statusMap[progress] || 'status-set-goals';
}

// Function to display search results
function displaySearchResults(searchResults, selectedTeam, selectedQuarter) {
    const employees = getEmployees();
    const resultsContainer = document.getElementById('progress-container');
    resultsContainer.innerHTML = '';
    const userRole = sessionStorage.getItem('userRole');

    // Other helper functions remain the same
    function getQuarterStartDate(quarterString) {
        const [quarter, year] = quarterString.split(' ');
        const quarterNum = parseInt(quarter.substring(1));
        const month = (quarterNum - 1) * 3;
        return new Date(parseInt(year), month, 1);
    }

    function formatDate(date) {
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }

    function getDueDateColor(dueDate, progress) {
        const today = new Date();
        if (progress === 100) {
            return 'color: #27ae60;';
        }
        if (today > dueDate) {
            return 'color: #dc3545;';
        }
        return 'color: #000000;';
    }

    const dueDate = getQuarterStartDate(selectedQuarter);
    const formattedDueDate = formatDate(dueDate);

    // Create searchResultsMap
    const searchResultsMap = new Map();
    if (searchResults && searchResults.value) {
        searchResults.value.forEach(result => {
            const name = result.fields.find(field => field.name === 'Name')?.values[0];
            const team = result.fields.find(field => field.name === 'Team')?.values[0];
            const quarter = result.fields.find(field => field.name === 'Quarter')?.values[0];
            const progress = result.fields.find(field => field.name === 'Progress')?.values[0];
            const performanceProgress = result.fields.find(field => field.name === 'Performanceprogress')?.values[0] || 0;
            const id = result.fields.find(field => field.name === 'id')?.values[0];
            const pid = result.fields.find(field => field.name === 'pid')?.values[0];

            if (name && quarter) {
                searchResultsMap.set(name + '-' + quarter, { team, progress, performanceProgress, id, pid });
            }
        });
    }

    // Filter employees based on user role and selected team
    const filteredEmployees = employees.filter(employee => {
        if (userRole === 'All') {
            return selectedTeam === 'all' || employee.team === selectedTeam;
        }
        return employee.team === userRole;
    });

    // Get counts for filtered employees
    const counts = getEmployeeCountsByStep(filteredEmployees, searchResultsMap, selectedTeam);

    // Remove existing tabs and initialize new ones
    const existingTabs = document.querySelector('.status-tabs');
    if (existingTabs) {
        existingTabs.remove();
    }
    initializeTabs(counts);

    const reviewList = document.createElement('div');
    reviewList.className = 'review-list';

    const header = document.createElement('div');
    header.className = 'review-list-header';
    header.innerHTML = `
        <div class="employee-info">Employee Name</div>
        <div class="status-section">
            <div class="status-col">Goals Status</div>
            <div class="step-col">Goals Step</div>
            <div class="due-date-col">Due Date</div>
            <div class="percent-col">Performance Review Status</div>
            <div class="actions-col">Actions</div>
        </div>
    `;
    reviewList.appendChild(header);

    // Display only filtered employees
    filteredEmployees.forEach(employee => {
        const { name, team } = employee;
        const key = name + '-' + selectedQuarter;
        const result = searchResultsMap.get(key);

        const progressValue = result ? parseFloat(result.progress) : 0;
        const performanceProgressValue = result ? parseFloat(result.performanceProgress) : 0;

        const dueDateColor = getDueDateColor(dueDate, progressValue);

        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        progressItem.setAttribute('data-progress', progressValue);

        const statusText = getStatusTextFromProgress(progressValue);
        const statusClass = getStatusClassFromProgress(progressValue);
        const performanceStatusText = getPerformanceStatusText(performanceProgressValue);
        const performanceStatusClass = getPerformanceStatusClass(performanceProgressValue);

        // Only show action buttons if progress is 100%
        let actionButtons = '';
        if (result) {
            // Initialize empty array to build buttons
            const buttons = [];

            // Add Goals button if progress is 100%
            if (progressValue === 100) {
                buttons.push(`
                    <button class="action-button" onclick="window.open('https://app.laserfiche.com/laserfiche/DocView.aspx?repo=r-618b7d56&customerId=961460947&id=${result.id}', '_blank')" title="View Goals">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>`);
            }

            // Add Performance Review button if performanceProgress is 100%
            if (performanceProgressValue === 100) {
                buttons.push(`
                    <button class="action-button" onclick="window.open('https://app.laserfiche.com/laserfiche/DocView.aspx?repo=r-618b7d56&customerId=961460947&id=${result.pid}', '_blank')" title="View Performance Review">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                    </button>`);
            }

            actionButtons = buttons.join('');
        }

        progressItem.innerHTML = `
        <div class="employee-info">
            <div class="checkbox"></div>
            <div class="name-title">
                <h4 class="employee-name">${name}</h4>
                <p class="employee-title">${team} Team</p>
            </div>
        </div>
        <div class="status-section">
            <span class="status-indicator ${statusClass}">${statusText}</span>
            <div class="step-progress-container" data-progress="${progressValue}">
                <div class="step ${progressValue >= 0 ? 'active' : ''}" data-step="1">
                    1<span class="step-label">Set Goals</span>
                </div>
                <div class="step ${progressValue >= 25 ? 'active' : ''}" data-step="2">
                    2<span class="step-label">Leader Review</span>
                </div>
                <div class="step ${progressValue >= 50 ? 'active' : ''}" data-step="3">
                    3<span class="step-label">Rework Goals</span>
                </div>
                <div class="step ${progressValue >= 75 ? 'active' : ''}" data-step="4">
                    4<span class="step-label">Leader Additional<br>Review</span>
                </div>
                <div class="step ${progressValue >= 100 ? 'active' : ''}" data-step="5">
                    5<span class="step-label">Goals Set!</span>
                </div>
            </div>
            <span class="due-date" style="${dueDateColor}">${formattedDueDate}</span>
            <span class="status-indicator ${performanceStatusClass}">${performanceStatusText}</span>
            <div class="actions">
                ${actionButtons}
            </div>
        </div>
    `;

        resultsContainer.appendChild(reviewList);
        reviewList.appendChild(progressItem);
    });
}

function getStatusDisplay(progress) {
    if (progress === 0) {
        return { text: 'Draft', class: 'status-draft' };
    } else if (progress < 100) {
        return { text: 'Awaiting Review', class: 'status-awaiting' };
    } else {
        return { text: 'Completed', class: 'status-completed' };
    }
}

async function fetchEmployeeGoals(accessToken) {
    const repositoryId = 'r-618b7d56';
    const team = document.getElementById('team-select').value;
    const quarter = document.getElementById('quarter-select').value;
    const userRole = sessionStorage.getItem('userRole');

    let searchCommand = '';
    if (userRole === 'All') {
        if (team === 'all' && quarter === 'all') {
            searchCommand = '{[SMART Goals]:[Quarter]="*"}';
        } else if (team === 'all') {
            searchCommand = `{[SMART Goals]:[Quarter]="${quarter}"}`;
        } else if (quarter === 'all') {
            searchCommand = `{[SMART Goals]:[Team]="${team} Team"}`;
        } else {
            searchCommand = `{[SMART Goals]:[Quarter]="${quarter}"} & {[SMART Goals]:[Team]="${team} Team"}`;
        }
    } else {
        if (quarter === 'all') {
            searchCommand = `{[SMART Goals]:[Team]="${userRole} Team"}`;
        } else {
            searchCommand = `{[SMART Goals]:[Quarter]="${quarter}"} & {[SMART Goals]:[Team]="${userRole} Team"}`;
        }
    }

    const searchUrl = `https://api.laserfiche.com/repository/v2/Repositories/${repositoryId}/SimpleSearches?fields=Name&fields=Team&fields=Quarter&fields=Goal1&fields=Goal2&fields=Goal3&formatFieldValues=false`;

    const searchData = {
        searchCommand: searchCommand
    };

    try {
        const response = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(searchData)
        });

        if (response.ok) {
            const searchResults = await response.json();
            displayEmployeeGoals(searchResults, team, quarter, userRole);
        } else if (response.status === 401) {
            refreshToken();
        } else {
            console.error('Error fetching employee goals:', response.status, response.statusText);
            // alert('Failed to fetch employee goals.');
        }
    } catch (error) {
        console.error('Error fetching employee goals:', error.message);
        // alert('Failed to fetch employee goals.');
    }
}

function displayEmployeeGoals(searchResults, selectedTeam, selectedQuarter, userRole) {
    const employees = getEmployees();
    const goalsContainer = document.getElementById('goals-container');
    goalsContainer.innerHTML = '';

    const searchResultsMap = new Map();
    searchResults.value.forEach(result => {
        const name = result.fields.find(field => field.name === 'Name').values[0];
        const team = result.fields.find(field => field.name === 'Team').values[0];
        const quarter = result.fields.find(field => field.name === 'Quarter').values[0];
        const goal1 = result.fields.find(field => field.name === 'Goal1').values[0];
        const goal2 = result.fields.find(field => field.name === 'Goal2').values[0];
        const goal3 = result.fields.find(field => field.name === 'Goal3').values[0];
        searchResultsMap.set(name + '-' + quarter, { team, goal1, goal2, goal3 });
    });

    employees.forEach(employee => {
        const { name, team } = employee;
        const key = name + '-' + selectedQuarter;
        const result = searchResultsMap.get(key);

        if ((userRole === 'All' && (selectedTeam === 'all' || team === selectedTeam)) ||
            (userRole !== 'All' && team === userRole)) {
            const goalElement = document.createElement('div');
            goalElement.classList.add('goal-item');
            goalElement.innerHTML = `
                <h4>${name}</h4>
                <ul>
                    <li>${result ? result.goal1 : 'No goal set'}</li>
                    <li>${result ? result.goal2 : 'No goal set'}</li>
                    <li>${result ? result.goal3 : 'No goal set'}</li>
                </ul>
            `;
            goalsContainer.appendChild(goalElement);
        }
    });
}

function updateTeamSelectOptions() {
    const teamSelect = document.getElementById('team-select');
    const userRole = sessionStorage.getItem('userRole');

    teamSelect.innerHTML = '<option value="all">All Teams</option>';

    if (userRole === 'All') {
        teamSelect.innerHTML += `
            <option value="IT">IT Team</option>
            <option value="BPA">BPA Team</option>
            <option value="Admin">Admin Team</option>
        `;
    } else {
        teamSelect.innerHTML += `<option value="${userRole}">${userRole} Team</option>`;
    }
}

function updateStepProgress(progressElement, value) {
    const steps = progressElement.querySelectorAll('.step');
    const container = progressElement.querySelector('.step-progress-container');
    steps.forEach(step => {
        const stepValue = parseInt(step.getAttribute('data-step'));
        if (value >= stepValue) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    container.style.setProperty('--progress-width', `${value}%`);
}

// Function to refresh access token
async function refreshToken() {
    const clientId = 'b493f960-3a0e-4a02-89f7-b09b9db97a1c';
    const clientSecret = 'CMoi3M0DVjzOCsXkZGmRg1A2QAyhNpo8IhKU3mafqFVFcUxp';
    const refreshToken = sessionStorage.getItem('refresh_token');

    const tokenUrl = 'https://signin.laserfiche.com/oauth/token';
    const auth = btoa(`${clientId}:${clientSecret}`);

    const data = new URLSearchParams();
    data.append('grant_type', 'refresh_token');
    data.append('refresh_token', refreshToken);
    data.append('scope', 'repository.Read table.Read');

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: data
        });

        if (!response.ok) {
            throw new Error('Failed to refresh access token');
        }

        const tokenData = await response.json();
        const newAccessToken = tokenData.access_token;
        const newRefreshToken = tokenData.refresh_token;

        sessionStorage.setItem('access_token', newAccessToken);
        sessionStorage.setItem('refresh_token', newRefreshToken);

        return newAccessToken;
    } catch (error) {
        console.error('Error refreshing access token:', error);
        // If refresh fails, redirect to login
        initiateLogin();
        return null;
    }
}

// Event listeners for dropdown changes
document.getElementById('team-select').addEventListener('change', () => {
    const accessToken = sessionStorage.getItem('access_token');
    if (accessToken) {
        if (window.location.pathname.includes('second-page.html')) {
            fetchEmployeeGoals(accessToken);
        } else {
            performSearch(accessToken);
        }
    }
});

document.getElementById('quarter-select').addEventListener('change', () => {
    const accessToken = sessionStorage.getItem('access_token');
    if (accessToken) {
        if (window.location.pathname.includes('second-page.html')) {
            fetchEmployeeGoals(accessToken);
        } else {
            performSearch(accessToken);
        }
    }
});