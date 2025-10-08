// Calculate age from birthdate
function calculateAge(birthdate) {
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

// Load profile data from JSON (for use with HTTP server)
async function loadProfile() {
    try {
        const response = await fetch('profile-data.json');
        const profileData = await response.json();
        
        // Calculate age if birthdate exists
        if (profileData.personalInfo.birthdate) {
            profileData.personalInfo.age = calculateAge(profileData.personalInfo.birthdate);
        }
        
        renderProfile(profileData);
    } catch (error) {
        console.error('Error loading profile data:', error);
        document.getElementById('leftPanel').innerHTML = '<div class="loading">Error loading profile data</div>';
        document.getElementById('rightPanel').innerHTML = '<div class="loading">Error loading profile data</div>';
    }
}

function renderProfile(data) {
    renderLeftPanel(data);
    renderRightPanel(data);
    updatePageTitle(data);
}

function updatePageTitle(data) {
    // Update page title
    document.getElementById('pageTitle').textContent = `${data.personalInfo.name} - ${data.personalInfo.title}`;
    
    // Update footer name and title
    document.getElementById('profileName').textContent = data.personalInfo.name;
    document.getElementById('profileTitle').textContent = data.personalInfo.title;
}

function renderLeftPanel(data) {
    const leftPanel = document.getElementById('leftPanel');
    leftPanel.innerHTML = `
        <div class="profile-section">
            <img src="${data.personalInfo.profileImage}" alt="Profile Photo" class="profile-img">
            <div class="username">
                <span class="keyword">public</span> ${data.personalInfo.name}
            </div>
        </div>

        <div class="section">
            <div class="section-content">
                ${data.platforms.primary.join(',<br>')}
            </div>
        </div>

        <div class="section">
            <div class="section-title">enum PLATFORMS</div>
        </div>

        <div class="section">
            <div class="section-content">
                ${data.platforms.secondary.join(',<br>')}
            </div>
        </div>

        <div class="section">
            <div class="section-title">enum LANGUAGES</div>
        </div>

        <div class="section">
            <div class="section-content">
                ${data.programmingLanguages.join('<br>')}
            </div>
        </div>

        <div class="section">
            <div class="section-title">WORK SKILLS</div>
        </div>

        <div class="section">
            <div class="section-content">
            <strong>Frontend:</strong> ${data.workSkills.frontend.join(', ')}<br><br>
            <strong>Backend:</strong> ${data.workSkills.backend.join(', ')}<br><br>
            <strong>Database:</strong> ${data.workSkills.database.join(', ')}<br><br>
            <strong>Cloud:</strong> ${data.workSkills.cloud.join(', ')}<br><br>
            <strong>Mobile:</strong> ${data.workSkills.mobile.join(', ')}<br><br>
            <strong>DevOps:</strong> ${data.workSkills.devops.join(', ')}
        </div>
        </div>

        <div class="section">
            <div class="section-title">TOOLS</div>
        </div>

        <div class="section">
            <div class="section-content">
                ${data.tools.join('<br>')}
            </div>
        </div>

        <div class="section">
            <div class="section-title">LANGUAGES SPOKEN</div>
        </div>

        <div class="section">
            <div class="section-content">
                ${Object.entries(data.spokenLanguages).map(([lang, level]) => `${lang} = ${level}`).join('<br>')}
            </div>
        </div>

        <div class="section">
            <div class="section-title">PROFILE</div>
        </div>

        <div class="section">
            <div class="section-content">
                ${data.profileTraits.join('<br>')}
            </div>
        </div>
    `;
}

function renderRightPanel(data) {
    const rightPanel = document.getElementById('rightPanel');
    
    // Summary section
    const summaryHTML = data.summary.lines.map(line => 
        `<div class="comment">/// ${line}</div>`
    ).join('');

    // Personal information section
    const personalInfoHTML = `
        <div class="code-section">
            <div class="code-line">
                <span class="keyword">public</span> <span class="class-name">INFORMATION</span>
            </div>
            <div class="code-line indent-1">
                <span class="keyword">public string</span> <span class="string">"${data.personalInfo.name}"</span>,
            </div>
            <div class="code-line indent-1">
                <span class="keyword">public string</span> <span class="string">"${data.personalInfo.title}"</span>,
            </div>
            <div class="code-line indent-1">
                <span class="keyword">public</span> <span class="type">email</span> <span class="string">"${data.personalInfo.email}"</span>,
            </div>
            <div class="code-line indent-1">
                <span class="keyword">public</span> <span class="type">PHONE</span> = <span class="string">${data.personalInfo.phone}</span>
            </div>
            <div class="code-line indent-1">
                <span class="keyword">public</span> <span class="type">LOCATION</span> = <span class="operator">[</span><span class="string">'${data.personalInfo.location[0]}'</span>, <span class="string">${data.personalInfo.location[1]}</span><span class="operator">]</span>
            </div>
            <div class="code-line">
                <span class="variable">VEHICLE_LICENSE</span> = <span class="boolean">${data.personalInfo.vehicleLicense}</span>
            </div>
            <div class="code-line">
                <span class="variable">AGE</span> = <span class="number">${data.personalInfo.age}</span>
            </div>
        </div>
    `;

    // Education section
    const educationHTML = `
        <div class="code-section">
            <div class="code-line">
                <span class="keyword">public static class</span> <span class="class-name">EDUCATION</span>
            </div>
            ${data.education.map((edu, index) => `
                <div class="code-line indent-1">
                    <span class="keyword">private void</span> <span class="method">Education${index + 1}</span>()
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Level</span> = <span class="string">"${edu.level}"</span>,
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Field</span> = <span class="string">"${edu.field}"</span>,
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Date</span> = <span class="string">"${edu.date}"</span>,
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Institution</span> = <span class="string">"${edu.institution}"</span>,
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">GPA</span> = <span class="number">${edu.GPA || 'N/A'}</span>
                </div>
            `).join('')}
        </div>
    `;

    // Experience section
    const experienceHTML = `
        <div class="code-section">
            <div class="code-line">
                <span class="keyword">public static class</span> <span class="class-name">EXPERIENCE</span>
            </div>
            ${data.experience.map((exp, index) => `
                <div class="code-line indent-1">
                    <span class="keyword">private void</span> <span class="method">Experience${index + 1}</span>()
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Company</span> = <span class="string">"${exp.company}"</span>,
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Role</span> = <span class="string">"${exp.role}"</span>,
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Duration</span> = <span class="string">"${exp.duration.start} - ${exp.duration.end}"</span>,
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Type</span> = <span class="string">"${exp.type}"</span>,
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Description</span> = <span class="string">"${exp.description.join(' ')}"</span>
                </div>
            `).join('')}
        </div>
    `;

    // Certifications section
    const certificationsHTML = data.certifications ? `
        <div class="code-section">
            <div class="code-line">
                <span class="keyword">public static class</span> <span class="class-name">CERTIFICATIONS</span>
            </div>
            ${data.certifications.map(cert => `
                <div class="code-line indent-1">
                    <span class="keyword">public void</span> <span class="method">${cert.name.replace(/\s+/g, '')}</span>
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Issuer</span> = <span class="string">"${cert.issuer}"</span>,
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Date</span> = <span class="string">"${cert.date}"</span>
                </div>
            `).join('')}
        </div>
    ` : '';

    // Projects section
    const getProjectIcon = (project) => {
        // Use custom icon from JSON if available, otherwise fallback to auto-detection
        if (project.icon) {
            return project.icon;
        }
        
        // Fallback to automatic emoji detection
        const name = project.name.toLowerCase();
        if (name.includes('tax') || name.includes('gov')) return '🏛️';
        if (name.includes('simple') || name.includes('fintech')) return '💰';
        if (name.includes('burtgel') || name.includes('ehalamj')) return '📋';
        if (name.includes('app') || name.includes('mobile')) return '📱';
        if (name.includes('web') || name.includes('frontend')) return '🌐';
        if (name.includes('backend') || name.includes('api')) return '⚙️';
        return '💻';
    };

    const projectsHTML = data.projects ? `
        <div class="code-section">
            <div class="code-line">
                <span class="keyword">public static class</span> <span class="class-name">PROJECTS</span>
            </div>
            ${data.projects.map((project, index) => `
                <div class="code-line indent-1">
                    <span class="keyword">private void</span> <span class="method">Project${index + 1}</span>()
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Name</span> = <span class="string">"${project.name}"</span>,
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Description</span> = <span class="string">"${project.description}"</span>,
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">Technologies</span> = <span class="operator">[</span><span class="string">'${project.technologies.join("', '")}'</span><span class="operator">]</span>,
                </div>
                <div class="code-line indent-2">
                    <span class="variable">var</span> <span class="variable">URL</span> = <span class="string">"${project.url}"</span>
                </div>
            `).join('')}
        </div>
    ` : '';

    rightPanel.innerHTML = `
        <div class="comment">/// &lt;summary&gt;</div>
        ${summaryHTML}

        ${personalInfoHTML}
        ${educationHTML}
        ${experienceHTML}
        ${certificationsHTML}
        ${projectsHTML}
    `;
}

// Robot eye tracking functionality
function initRobotEyeTracking() {
    // Wait a bit for DOM to be fully loaded
    setTimeout(() => {
        const robotContainer = document.getElementById('robotContainer');
        const leftEye = document.querySelector('.left-eye');
        const rightEye = document.querySelector('.right-eye');
        const leftPupil = document.querySelector('.left-eye .robot-pupil');
        const rightPupil = document.querySelector('.right-eye .robot-pupil');
        
        console.log('Robot elements found:', {
            robotContainer: !!robotContainer,
            leftEye: !!leftEye,
            rightEye: !!rightEye,
            leftPupil: !!leftPupil,
            rightPupil: !!rightPupil
        });
        
        if (!robotContainer || !leftEye || !rightEye || !leftPupil || !rightPupil) {
            console.log('Robot elements not found, retrying...');
            setTimeout(initRobotEyeTracking, 1000);
            return;
        }
        
        let isTracking = false;
        let blinkTimeout;
        
        // Get robot position
        function getRobotPosition() {
            const rect = robotContainer.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        }
        
        // Calculate eye movement based on mouse position
        function updateEyePosition(mouseX, mouseY) {
            const robotPos = getRobotPosition();
            const deltaX = mouseX - robotPos.x;
            const deltaY = mouseY - robotPos.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // Limit eye movement range
            const maxDistance = 300;
            const limitedDistance = Math.min(distance, maxDistance);
            const ratio = limitedDistance / maxDistance;
            
            // Calculate eye movement (limited to eye boundaries)
            const eyeMoveX = distance > 0 ? (deltaX / distance) * ratio * 4 : 0; // Max 4px movement
            const eyeMoveY = distance > 0 ? (deltaY / distance) * ratio * 3 : 0; // Max 3px movement
            
            // Apply movement to pupils
            leftPupil.style.transform = `translate(calc(-50% + ${eyeMoveX}px), calc(-50% + ${eyeMoveY}px))`;
            rightPupil.style.transform = `translate(calc(-50% + ${eyeMoveX}px), calc(-50% + ${eyeMoveY}px))`;
            
            // Calculate arm movement based on mouse position
            updateArmPosition(mouseX, mouseY, robotPos);
            
            console.log('Eye tracking:', { mouseX, mouseY, robotPos, deltaX, deltaY, eyeMoveX, eyeMoveY });
        }
        
        // Calculate arm movement based on mouse position
        function updateArmPosition(mouseX, mouseY, robotPos) {
            const leftArm = document.querySelector('.left-arm');
            const rightArm = document.querySelector('.right-arm');
            
            console.log('Arm elements found:', { leftArm: !!leftArm, rightArm: !!rightArm });
            
            if (!leftArm || !rightArm) return;
            
            const deltaX = mouseX - robotPos.x;
            const deltaY = mouseY - robotPos.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            if (distance > 0) {
                // Calculate angle for arm pointing (more direct pointing)
                const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
                
                // Convert angle to arm rotation - arms can point upward and downward
                // Left arm points more directly at mouse (can rotate upward)
                const leftArmAngle = Math.max(-120, Math.min(120, angle - 45));
                // Right arm points more directly at mouse (can rotate upward)
                const rightArmAngle = Math.max(-120, Math.min(120, angle - 135));
                
                // Apply rotation to arms with smooth transition
                leftArm.style.transform = `rotate(${leftArmAngle}deg)`;
                rightArm.style.transform = `rotate(${rightArmAngle}deg)`;
                
                console.log('Arm tracking applied:', { 
                    angle, 
                    leftArmAngle, 
                    rightArmAngle, 
                    deltaX, 
                    deltaY,
                    leftArmTransform: leftArm.style.transform,
                    rightArmTransform: rightArm.style.transform
                });
            }
        }
        
        // Blink animation
        function blink() {
            leftEye.classList.add('tracking');
            rightEye.classList.add('tracking');
            
            setTimeout(() => {
                leftEye.classList.remove('tracking');
                rightEye.classList.remove('tracking');
            }, 300);
        }
        
        // Mouse move event
        document.addEventListener('mousemove', (e) => {
            if (!isTracking) {
                isTracking = true;
                console.log('Started tracking mouse');
                // Random blink when starting to track
                if (Math.random() < 0.3) {
                    setTimeout(blink, 500);
                }
            }
            
            updateEyePosition(e.clientX, e.clientY);
            
            // Clear existing blink timeout
            clearTimeout(blinkTimeout);
            
            // Random blink during tracking
            if (Math.random() < 0.001) { // Very low probability for natural blinking
                blinkTimeout = setTimeout(blink, Math.random() * 2000);
            }
        });
        
        // Continuous arm tracking - arms always point to mouse even when not moving
        let lastMouseX = 0;
        let lastMouseY = 0;
        
        // Track mouse position continuously
        document.addEventListener('mousemove', (e) => {
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        });
        
        // Update arms every 100ms to ensure they always point to mouse
        setInterval(() => {
            if (lastMouseX !== 0 || lastMouseY !== 0) {
                const robotPos = getRobotPosition();
                updateArmPosition(lastMouseX, lastMouseY, robotPos);
            }
        }, 100);
        
        // Mouse leave event - reset eyes and arms to center
        document.addEventListener('mouseleave', () => {
            isTracking = false;
            console.log('Stopped tracking mouse');
            leftPupil.style.transform = 'translate(-50%, -50%)';
            rightPupil.style.transform = 'translate(-50%, -50%)';
            
            // Reset arms to default position
            const leftArm = document.querySelector('.left-arm');
            const rightArm = document.querySelector('.right-arm');
            if (leftArm && rightArm) {
                leftArm.style.transform = 'rotate(0deg)';
                rightArm.style.transform = 'rotate(0deg)';
            }
        });
        
        // Periodic blink when not tracking
        setInterval(() => {
            if (!isTracking && Math.random() < 0.1) {
                blink();
            }
        }, 3000);
        
        console.log('Robot eye tracking initialized successfully');
    }, 500);
}

// Rocket effect functionality
function initRocketEffect() {
    const rocketContainer = document.getElementById('rocketContainer');
    
    if (!rocketContainer) return;
    
    // Click event listener for rocket launch
    document.addEventListener('click', (e) => {
        // Don't launch rocket if clicking on robot
        if (e.target.closest('.robot-container')) return;
        
        launchRocket(e.clientX, e.clientY);
    });
    
    function launchRocket(targetX, targetY) {
        const robotContainer = document.getElementById('robotContainer');
        if (!robotContainer) return;
        
        // Get robot position
        const robotRect = robotContainer.getBoundingClientRect();
        const robotX = robotRect.left + robotRect.width / 2;
        const robotY = robotRect.top + robotRect.height / 2;
        
        // Create rocket element with emoji
        const rocket = document.createElement('div');
        rocket.className = 'rocket';
        rocket.innerHTML = '🚀';
        rocket.style.left = robotX + 'px';
        rocket.style.top = robotY + 'px';
        
        // Create enhanced smoke trail
        const trail = document.createElement('div');
        trail.className = 'rocket-trail';
        trail.style.left = (robotX - 2) + 'px';
        trail.style.top = (robotY + 20) + 'px';
        
        // Create fire effect
        const fire = document.createElement('div');
        fire.className = 'rocket-fire';
        fire.style.left = (robotX - 8) + 'px';
        fire.style.top = (robotY + 30) + 'px';
        
        // Add to container
        rocketContainer.appendChild(rocket);
        rocketContainer.appendChild(trail);
        rocketContainer.appendChild(fire);
        
        // Make robot smile and turn 180 degrees
        const robotFace = document.querySelector('.robot-face');
        if (robotFace) {
            robotFace.classList.add('robot-smile');
        }
        if (robotContainer) {
            robotContainer.classList.add('robot-turned');
        }
        
        // Calculate rocket path
        const deltaX = targetX - robotX;
        const deltaY = targetY - robotY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        
        // Set rocket rotation
        rocket.style.transform = `rotate(${angle}deg)`;
        trail.style.transform = `rotate(${angle}deg)`;
        
        // Animate rocket movement
        const animationDuration = 1000; // 1 second
        const startTime = Date.now();
        
        function animateRocket() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);
            
            // Easing function for smooth movement
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            const currentX = robotX + (deltaX * easeOut);
            const currentY = robotY + (deltaY * easeOut);
            
            rocket.style.left = currentX + 'px';
            rocket.style.top = currentY + 'px';
            trail.style.left = (currentX - 2) + 'px';
            trail.style.top = (currentY + 20) + 'px';
            fire.style.left = (currentX - 8) + 'px';
            fire.style.top = (currentY + 30) + 'px';
            
            if (progress < 1) {
                requestAnimationFrame(animateRocket);
            } else {
                // Create explosion effect
                createExplosion(targetX, targetY);
                
                // Reset robot smile and turn back
                const robotFace = document.querySelector('.robot-face');
                const robotContainer = document.getElementById('robotContainer');
                if (robotFace) {
                    robotFace.classList.remove('robot-smile');
                }
                if (robotContainer) {
                    robotContainer.classList.remove('robot-turned');
                }
                
                // Remove rocket, trail, and fire
                setTimeout(() => {
                    if (rocket.parentNode) rocket.parentNode.removeChild(rocket);
                    if (trail.parentNode) trail.parentNode.removeChild(trail);
                    if (fire.parentNode) fire.parentNode.removeChild(fire);
                }, 100);
            }
        }
        
        requestAnimationFrame(animateRocket);
    }
    
    function createExplosion(x, y) {
        const explosion = document.createElement('div');
        explosion.className = 'rocket-explosion';
        explosion.style.left = x + 'px';
        explosion.style.top = y + 'px';
        
        rocketContainer.appendChild(explosion);
        
        // Remove explosion after animation
        setTimeout(() => {
            if (explosion.parentNode) explosion.parentNode.removeChild(explosion);
        }, 600);
    }
}

// Load profile when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    initRobotEyeTracking();
    initRocketEffect();
});
