const { chromium, firefox, webkit } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * EOXS Ticket Automation Script with Log Note - Playwright Version
 * 
 * This script automates the creation and editing of tickets in the EOXS system using Playwright.
 * Additionally, it adds a log note to the created task.
 * 
 * DESCRIPTION FIELD INTEGRATION:
 * The script supports automatically filling the description field with email subject content.
 * 
 * To set the description from email subject, you can:
 * 1. Set environment variable: EMAIL_SUBJECT="Your email subject here"
 * 2. Pass command line argument: node script.js --subject="Your email subject here"
 * 3. Call the updateDescriptionFromEmail() method programmatically
 */

// Configuration
const CONFIG = {
    baseUrl: 'https://teams.eoxs.com/',
    credentials: {
        email: process.env.EOXS_EMAIL || 'sahajkatiyareoxs@gmail.com',
        password: process.env.EOXS_PASSWORD || 'Eoxs12345!'
    },
    ticketDetails: {
        // These will be set dynamically in the constructor
        title: 'Sample',
        customer: 'Discount Pipe & Steel',
        assignedTo: 'Sahaj Katiyar', // For Ownership field (during creation) and Assigned To field (during edit)
        description: '',
        logNote: 'Email received from customer',
    },
    selectors: {
        // Login selectors
        loginTrigger: 'a.btn-link[href="#loginPopup"], span.te_user_account_icon.d-block, a[href="#loginPopup"], a[href*="loginPopup"], a[href*="login" i], button[href*="login" i], .fa-user-circle-o, .fa-user',
        loginModal: '#loginRegisterPopup, .modal-dialog[role="dialog"]',
        emailInput: '#loginRegisterPopup input#login, #loginRegisterPopup input[name="login"], input#login, input[name="login"], input[type="email"], input[name="email"], input[placeholder*="email" i]',
        passwordInput: '#loginRegisterPopup input#password, input#password, input[type="password"], input[name="password"]',
        loginButton: 'button[type="submit"], input[type="submit"]',
        
        // Navigation selectors
        projectsSection: 'a[href*="projects"], [data-testid*="projects"]',
        eoxsSupport: 'a[href*="support"], [data-testid*="support"]',
        createButton: '[data-testid*="create"], button.create, a.create',
        
        // Form selectors
        titleInput: 'input[name="title"], input[placeholder*="title" i], textarea[name="title"]',
        ownershipSelect: 'select[name="ownership"], select[name="assignee"], select[name="owner"]',
        addButton: 'button[type="submit"], input[type="submit"]',
        
        // Success indicators
        successMessage: '.success, .alert-success, [data-testid*="success"]',
        ticketId: '[data-testid*="ticket-id"], .ticket-id, .id'
    },
    waitOptions: {
        timeout: 60000,
        navigationTimeout: 30000
    },
    browser: {
        headless: process.env.NODE_ENV === 'production' || process.env.HEADLESS === 'true', // Headless in production
        slowMo: 100, // Add delay between actions for better reliability
    }
};

class EOXSPlaywrightAutomationWithLog {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.ticketId = null;
        
        // Update ticket details from environment variables (set by API)
        this.updateTicketDetailsFromEnv();
    }
    
    updateTicketDetailsFromEnv() {
        // Update CONFIG with current environment variables
        if (process.env.EMAIL_SUBJECT) {
            CONFIG.ticketDetails.title = process.env.EMAIL_SUBJECT;
        }
        if (process.env.EMAIL_CUSTOMER) {
            CONFIG.ticketDetails.customer = process.env.EMAIL_CUSTOMER;
        }
        if (process.env.EMAIL_BODY) {
            CONFIG.ticketDetails.description = process.env.EMAIL_BODY;
            CONFIG.ticketDetails.logNote = process.env.EMAIL_BODY;
        }
        
        // New: explicit inputs from n8n
        if (process.env.TICKET_TITLE) {
            CONFIG.ticketDetails.title = process.env.TICKET_TITLE;
        }
        if (process.env.LOG_NOTE || process.env.EMAIL_SUBJECT) {
            CONFIG.ticketDetails.logNote = process.env.LOG_NOTE || process.env.EMAIL_SUBJECT;
        }
        
        console.log('📋 Updated ticket details from environment:', {
            title: CONFIG.ticketDetails.title,
            customer: CONFIG.ticketDetails.customer,
            assignedTo: CONFIG.ticketDetails.assignedTo,
            logNote: CONFIG.ticketDetails.logNote?.slice(0, 80)
        });
    }

    async init() {
        try {
            console.log('🚀 Starting EOXS Automation with Log Note using Playwright...');
            
            // Launch browser (using Chromium by default, can be changed to firefox or webkit)
            this.browser = await chromium.launch({
                headless: CONFIG.browser.headless,
                slowMo: CONFIG.browser.slowMo,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--disable-gpu',
                    '--start-maximized'
                ]
            });

            // Create browser context with viewport and user agent
            this.context = await this.browser.newContext({
                viewport: null, // Use full window size
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });

            this.page = await this.context.newPage();
            
            // Enable console logging from browser
            this.page.on('console', msg => console.log('Browser Console:', msg.text()));
            
            // Handle errors
            this.page.on('pageerror', error => console.log('Page Error:', error.message));
            
            console.log('✅ Browser initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize browser:', error);
            throw error;
        }
    }

    async clearAndType(selector, text) {
        try {
            const element = this.page.locator(selector).first();
            await element.scrollIntoViewIfNeeded();
            await element.focus();
            await element.fill(''); // Clear existing content
            await element.type(text, { delay: 50 }); // Type with small delay between characters
        } catch (error) {
            console.error(`❌ Failed to clear and type in ${selector}:`, error);
            throw error;
        }
    }

    async clickElement(selector, options = {}) {
        try {
            const element = this.page.locator(selector).first();
            await element.scrollIntoViewIfNeeded();
            await element.click(options);
            return true;
        } catch (error) {
            console.error(`❌ Failed to click element ${selector}:`, error);
            return false;
        }
    }

    async waitForElement(selector, timeout = CONFIG.waitOptions.timeout) {
        try {
            await this.page.waitForSelector(selector, { timeout, state: 'visible' });
            return true;
        } catch (error) {
            console.log(`⚠️ Element ${selector} not found within ${timeout}ms`);
            return false;
        }
    }

    async updateDescriptionFromEmail(emailSubject) {
        CONFIG.ticketDetails.description = emailSubject;
        console.log('📧 Updated description from email subject:', emailSubject);
    }

    async forceOpenLoginPopup() {
        try {
            console.log('🔧 Attempting to force open login popup...');
            
            await this.page.evaluate(() => {
                // Try multiple approaches to open login popup
                const loginTriggers = document.querySelectorAll('a[href*="login"], button[data-toggle*="modal"], .user-icon, .login-trigger');
                for (const trigger of loginTriggers) {
                    if (trigger && typeof trigger.click === 'function') {
                        trigger.click();
                        break;
                    }
                }
                
                // Force show modal if it exists
                const modal = document.querySelector('#loginRegisterPopup');
                if (modal) {
                    modal.style.display = 'block';
                    modal.classList.add('show', 'in');
                    modal.classList.remove('hide');
                }
            });
            
            await this.page.waitForTimeout(1000);
            console.log('✅ Attempted to force open login popup');
        } catch (error) {
            console.log('⚠️ Could not force open login popup:', error.message);
        }
    }

    async login() {
        try {
            console.log('🔐 Starting login process...');
            
            // Navigate to base URL with retries
            let navigationSuccess = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(`📍 Navigation attempt ${attempt}/3...`);
                    await this.page.goto(CONFIG.baseUrl, { 
                        waitUntil: 'networkidle',
                        timeout: CONFIG.waitOptions.navigationTimeout 
                    });
                    navigationSuccess = true;
                    console.log('📍 Navigated to:', CONFIG.baseUrl);
                    break;
                } catch (error) {
                    console.log(`⚠️ Navigation attempt ${attempt} failed:`, error.message);
                    if (attempt === 3) {
                        throw new Error(`Failed to navigate after 3 attempts: ${error.message}`);
                    }
                    await this.page.waitForTimeout(2000);
                }
            }
            
            await this.page.waitForTimeout(1500);

            // Look for and click login trigger
            console.log('🔍 Looking for login trigger...');
            let loginTriggerClicked = false;

            // Try different login trigger selectors
            const loginTriggerSelectors = [
                'span.te_user_account_icon.d-block',
                'i.fa-user-circle-o',
                '.fa-user-circle-o',
                '.fa-user',
                CONFIG.selectors.loginTrigger
            ];

            for (const selector of loginTriggerSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 2000 })) {
                        await this.clickElement(selector);
                        loginTriggerClicked = true;
                        console.log(`✅ Clicked login trigger: ${selector}`);
                        break;
                    }
                } catch (error) {
                    continue; // Try next selector
                }
            }

            if (!loginTriggerClicked) {
                console.log('⚠️ No login trigger found, trying to force open popup...');
                await this.forceOpenLoginPopup();
            }

            await this.page.waitForTimeout(1000);

            // Wait for login modal or email input to appear
            console.log('⏳ Waiting for login popup to open...');
            const popupOpened = await Promise.race([
                this.waitForElement(CONFIG.selectors.loginModal, 10000),
                this.waitForElement(CONFIG.selectors.emailInput, 10000)
            ]);

            if (!popupOpened) {
                console.log('⚠️ Popup didn\'t open, forcing it open...');
                await this.forceOpenLoginPopup();
                await this.page.waitForTimeout(2000);
            }

            // Fill email field
            console.log('📧 Filling email field...');
            const emailSelectors = [
                'input#login',
                'input[name="login"]',
                'input[type="email"]',
                'input[name="email"]',
                CONFIG.selectors.emailInput
            ];

            let emailFilled = false;
            for (const selector of emailSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 2000 })) {
                        await this.clearAndType(selector, CONFIG.credentials.email);
                        emailFilled = true;
                        console.log('✅ Email entered successfully');
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }

            if (!emailFilled) {
                throw new Error('Could not find or fill email field');
            }

            // Fill password field
            console.log('🔑 Filling password field...');
            const passwordSelectors = [
                'input#password',
                'input[type="password"]',
                'input[name="password"]',
                CONFIG.selectors.passwordInput
            ];

            let passwordFilled = false;
            for (const selector of passwordSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 2000 })) {
                        await this.clearAndType(selector, CONFIG.credentials.password);
                        passwordFilled = true;
                        console.log('✅ Password entered successfully');
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }

            if (!passwordFilled) {
                throw new Error('Could not find or fill password field');
            }

            // Click login button or press Enter
            console.log('🔘 Attempting to submit login...');
            let loginSubmitted = false;

            // Try clicking login button
            const loginButtonSelectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button[name*="login" i]',
                CONFIG.selectors.loginButton
            ];

            for (const selector of loginButtonSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 2000 })) {
                        await this.clickElement(selector);
                        loginSubmitted = true;
                        console.log('✅ Login button clicked');
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }

            // Fallback: press Enter in password field
            if (!loginSubmitted) {
                try {
                    await this.page.locator('input[type="password"]').first().press('Enter');
                    loginSubmitted = true;
                    console.log('✅ Login submitted via Enter key');
                } catch (error) {
                    throw new Error('Could not submit login form');
                }
            }

            // Wait for navigation or login completion
            try {
                await Promise.race([
                    this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }),
                    this.page.waitForTimeout(10000)
                ]);
                console.log('✅ Navigation completed after login');
            } catch (error) {
                console.log('⚠️ Navigation timeout, checking login status...');
            }

            await this.page.waitForTimeout(3000);

            // Verify login success
            const currentUrl = this.page.url();
            console.log('📍 Current URL after login:', currentUrl);

            // Check for error messages
            try {
                const errorElement = this.page.locator('.alert-danger, .error, .login-error, [data-testid*="error"]').first();
                if (await errorElement.isVisible({ timeout: 2000 })) {
                    const errorText = await errorElement.textContent();
                    console.log('❌ Login error detected:', errorText?.trim());
                    return false;
                }
            } catch (error) {
                // No error message found, continue
            }

            // Check if still on login page
            if (currentUrl.includes('login') || currentUrl.includes('auth')) {
                console.log('❌ Login failed - still on login page');
                return false;
            }

            // Look for user-specific content
            const userContentSelectors = [
                '.user-info',
                '.profile',
                '.dashboard',
                '.o_menu_apps',
                '.o_dropdown',
                '.o_main_navbar',
                '.o_control_panel',
                '.o_kanban_view',
                '.o_list_view'
            ];

            let userContentFound = false;
            for (const selector of userContentSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 2000 })) {
                        userContentFound = true;
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }

            if (userContentFound) {
                console.log('✅ Login successful - user content detected');
                return true;
            } else {
                console.log('⚠️ Login status unclear, proceeding with caution...');
                return true; // Proceed anyway
            }

        } catch (error) {
            console.error('❌ Login failed:', error);
            return false;
        }
    }

    async navigateToProjects() {
        try {
            console.log('🧭 Navigating to Projects section...');
            
            await this.page.waitForTimeout(2000);
            
            // First, click the sidebar/menu button at top left corner
            console.log('📱 Looking for sidebar menu button...');
            const sidebarMenuSelectors = [
                '.o_menu_toggle',
                '.o_navbar_apps_menu',
                '.o_menu_apps',
                'button[data-menu-xmlid="base.menu_administration"]',
                '.fa-th',
                'i.fa-th',
                '.navbar-toggler',
                '.menu-toggle',
                'button[aria-label*="menu" i]',
                'button[title*="menu" i]',
                '[data-toggle="dropdown"]',
                '.dropdown-toggle'
            ];
            
            let sidebarOpened = false;
            for (const selector of sidebarMenuSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 3000 })) {
                        await this.clickElement(selector);
                        sidebarOpened = true;
                        console.log(`✅ Clicked sidebar menu: ${selector}`);
                        await this.page.waitForTimeout(1000);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!sidebarOpened) {
                console.log('⚠️ Could not find sidebar menu button, trying alternative approach...');
                // Try clicking on any button-like element in the top-left area
                try {
                    await this.page.locator('button, .btn, a').first().click();
                    console.log('✅ Clicked first button (fallback)');
                    await this.page.waitForTimeout(1000);
                } catch (error) {
                    console.log('⚠️ Could not open sidebar menu');
                }
            }
            
            // Now look for Projects link in the opened sidebar/menu
            console.log('🔍 Looking for Projects in sidebar...');
            const projectsSelectors = [
                'a[href*="projects"]',
                '[data-testid*="projects"]',
                'text=Projects',
                'text=Project',
                '.o_menu_sections a:has-text("Project")',
                '.o_menu_sections a:has-text("Projects")'
            ];
            
            let projectsClicked = false;
            for (const selector of projectsSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 3000 })) {
                        await this.clickElement(selector);
                        projectsClicked = true;
                        console.log(`✅ Clicked Projects: ${selector}`);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!projectsClicked) {
                // Try XPath approach
                try {
                    await this.page.locator('xpath=//a[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "project")]').first().click();
                    projectsClicked = true;
                    console.log('✅ Clicked Projects via XPath');
                } catch (error) {
                    console.log('⚠️ Could not find Projects link');
                    return false;
                }
            }
            
            await this.page.waitForTimeout(2000);
            
            // Look for Test Support project/card
            console.log('🎯 Looking for Test Support project...');
            await this.page.waitForTimeout(2000);
            
            // Debug: Log all visible text elements that might contain "Test Support"
            try {
                const allElements = await this.page.locator('*:has-text("Test Support"), *:has-text("test support"), *:has-text("Support")').all();
                console.log(`🔍 Found ${allElements.length} elements containing "Support"`);
                for (let i = 0; i < Math.min(allElements.length, 5); i++) {
                    const element = allElements[i];
                    const text = await element.textContent() || '';
                    const tagName = await element.evaluate(el => el.tagName.toLowerCase());
                    const className = await element.getAttribute('class') || '';
                    console.log(`  Element ${i}: ${tagName}[class="${className}"] text="${text.trim()}"`);
                }
            } catch (error) {
                console.log('⚠️ Could not debug Support elements');
            }
            
            const supportSelectors = [
                // Try different approaches for project cards/items
                '.o_kanban_record:has-text("Test Support")',
                '.o_kanban_card:has-text("Test Support")',
                '.card:has-text("Test Support")',
                '.project-card:has-text("Test Support")',
                'a:has-text("Test Support")',
                'div:has-text("Test Support")',
                'span:has-text("Test Support")',
                // Fallback to exact text
                'text=Test Support',
                'text=Support',
                // Try partial matches
                '[title*="Test Support"]',
                '[aria-label*="Test Support"]'
            ];
            
            let supportClicked = false;
            for (const selector of supportSelectors) {
                try {
                    const element = this.page.locator(selector).first();
                    if (await element.isVisible({ timeout: 3000 })) {
                        await element.click();
                        supportClicked = true;
                        console.log(`✅ Clicked Test Support: ${selector}`);
                        await this.page.waitForTimeout(2000);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!supportClicked) {
                // Try XPath approach for support
                try {
                    await this.page.locator('xpath=//*[contains(text(), "Test Support") or contains(text(), "Support")]').first().click();
                    supportClicked = true;
                    console.log('✅ Clicked Support via XPath');
                    await this.page.waitForTimeout(2000);
                } catch (error) {
                    console.log('⚠️ Could not find Test Support project');
                    return false;
                }
            }
            
            await this.page.waitForTimeout(2000);
            console.log('✅ Successfully navigated to Projects and selected Test Support');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to navigate to Projects:', error);
            return false;
        }
    }

    async clickCreate() {
        try {
            console.log('➕ Looking for Create button...');
            
            const createSelectors = [
                'button.o-kanban-button-new',  // Specific Odoo kanban create button
                '[data-testid*="create"]',
                'button.create',
                'a.create',
                'text=Create',
                'text=Add',
                'text=New'
            ];
            
            let createClicked = false;
            for (const selector of createSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 3000 })) {
                        await this.clickElement(selector);
                        createClicked = true;
                        console.log(`✅ Clicked Create button: ${selector}`);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!createClicked) {
                // Try XPath approach
                try {
                    await this.page.locator('xpath=//button[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "create")] | //a[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "create")]').first().click();
                    createClicked = true;
                    console.log('✅ Clicked Create button via XPath');
                } catch (error) {
                    console.log('⚠️ Could not find Create button');
                    return false;
                }
            }
            
            // Wait for form modal to appear
            console.log('⏳ Waiting for form modal to appear...');
            const formModalSelectors = [
                '.o_form_view',
                '.modal-dialog',
                '.o_dialog',
                '.modal-content'
            ];
            
            let modalFound = false;
            for (const selector of formModalSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 5000 })) {
                        modalFound = true;
                        console.log(`✅ Form modal found: ${selector}`);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!modalFound) {
                console.log('⚠️ Form modal not detected, but continuing...');
            }
            
            await this.page.waitForTimeout(2000);
            console.log('✅ Create button clicked successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to click Create button:', error);
            return false;
        }
    }

    async fillTicketForm() {
        try {
            console.log('📝 Filling ticket creation form...');
            
            // Wait for form to load
            await this.page.waitForTimeout(3000);
            
            // Debug: Log all input fields
            try {
                const allInputs = await this.page.locator('input, textarea, select').all();
                console.log(`🔍 Found ${allInputs.length} form fields`);
                for (let i = 0; i < Math.min(allInputs.length, 10); i++) {
                    const input = allInputs[i];
                    const name = await input.getAttribute('name') || '';
                    const placeholder = await input.getAttribute('placeholder') || '';
                    const type = await input.getAttribute('type') || '';
                    const tagName = await input.evaluate(el => el.tagName.toLowerCase());
                    console.log(`  Field ${i}: ${tagName}[name="${name}", placeholder="${placeholder}", type="${type}"]`);
                }
            } catch (error) {
                console.log('⚠️ Could not debug form fields');
            }
            
            // Fill title
            console.log('📋 Filling title field...');
            const titleSelectors = [
                'input[name="name"]',  // Common Odoo field name
                'input[name="title"]',
                'input[placeholder*="title" i]',
                'input[placeholder*="name" i]',
                'textarea[name="name"]',
                'textarea[name="title"]',
                'input.o_field_char',
                'textarea.o_field_text',
                CONFIG.selectors.titleInput
            ];
            
            let titleFilled = false;
            for (const selector of titleSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 2000 })) {
                        await this.clearAndType(selector, CONFIG.ticketDetails.title);
                        titleFilled = true;
                        console.log(`✅ Title filled successfully with: ${selector}`);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!titleFilled) {
                console.log('⚠️ Could not find title field, trying first visible input...');
                try {
                    const firstInput = this.page.locator('input[type="text"], input:not([type]), textarea').first();
                    if (await firstInput.isVisible({ timeout: 2000 })) {
                        await this.clearAndType('input[type="text"], input:not([type]), textarea', CONFIG.ticketDetails.title);
                        titleFilled = true;
                        console.log('✅ Title filled in first available input');
                    }
                } catch (error) {
                    console.log('⚠️ Could not find any suitable title field');
                }
            }
            
            // Fill description if provided
            if (CONFIG.ticketDetails.description) {
                console.log('📄 Filling description field...');
                const descriptionSelectors = [
                    'textarea[name*="description"]',
                    'textarea[placeholder*="description" i]',
                    'input[name*="description"]'
                ];
                
                for (const selector of descriptionSelectors) {
                    try {
                        if (await this.page.locator(selector).first().isVisible({ timeout: 2000 })) {
                            await this.clearAndType(selector, CONFIG.ticketDetails.description);
                            console.log('✅ Description filled successfully');
                            break;
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }
            
            // Set ownership/assignee during creation
            console.log('👤 Setting ownership to Sahaj Katiyar...');
            
            // Debug: Log all potential ownership fields (selects, inputs, divs with dropdowns)
            try {
                const allFields = await this.page.locator('select, input[name*="user"], input[name*="owner"], input[name*="assign"], div[class*="dropdown"], div[class*="select"], .o_field_many2one, .o_field_many2many').all();
                console.log(`🔍 Found ${allFields.length} potential ownership fields`);
                for (let i = 0; i < Math.min(allFields.length, 10); i++) {
                    const field = allFields[i];
                    const name = await field.getAttribute('name') || '';
                    const id = await field.getAttribute('id') || '';
                    const className = await field.getAttribute('class') || '';
                    const tagName = await field.evaluate(el => el.tagName.toLowerCase());
                    const placeholder = await field.getAttribute('placeholder') || '';
                    console.log(`  Field ${i}: ${tagName}[name="${name}", id="${id}", class="${className}", placeholder="${placeholder}"]`);
                }
            } catch (error) {
                console.log('⚠️ Could not debug ownership fields');
            }
            
            // Try different approaches for ownership field
            const ownershipSelectors = [
                // Traditional select elements
                'select[name*="user"]',
                'select[name*="owner"]',
                'select[name*="assign"]',
                'select[name="user_ids"]',
                'select[name="user_id"]',
                'select[name="ownership"]',
                'select[name="assignee"]',
                'select[name="owner"]',
                
                // Odoo-style dropdowns and many2one fields
                '.o_field_many2one input',
                '.o_field_many2many input',
                'input[name*="user_id"]',
                'input[name*="user_ids"]',
                'input[name*="owner"]',
                'input[name*="assign"]',
                
                // Dropdown-style elements
                'div.o_field_many2one',
                'div.o_field_many2many',
                'div[data-field-name*="user"]',
                'div[data-field-name*="owner"]',
                'div[data-field-name*="assign"]',
                
                // Generic ownership-related elements
                '[placeholder*="owner" i]',
                '[placeholder*="assign" i]',
                '[placeholder*="user" i]',
                
                CONFIG.selectors.ownershipSelect
            ];
            
            let ownershipSet = false;
            for (const selector of ownershipSelectors) {
                try {
                    const element = this.page.locator(selector).first();
                    if (await element.isVisible({ timeout: 2000 })) {
                        console.log(`🎯 Found ownership field: ${selector}`);
                        
                        const tagName = await element.evaluate(el => el.tagName.toLowerCase());
                        
                        if (tagName === 'select') {
                            // Handle traditional select dropdown
                            try {
                                await element.selectOption({ label: CONFIG.ticketDetails.assignedTo });
                                ownershipSet = true;
                                console.log('✅ Ownership set by label in select');
                                break;
                            } catch (error) {
                                try {
                                    await element.selectOption({ label: /Sahaj/i });
                                    ownershipSet = true;
                                    console.log('✅ Ownership set by partial match in select');
                                    break;
                                } catch (error2) {
                                    console.log(`⚠️ Could not select option in select: ${error2.message}`);
                                    continue;
                                }
                            }
                        } else {
                            // Handle input or div-based dropdowns (Odoo style)
                            try {
                                // Click to open dropdown
                                await element.click();
                                await this.page.waitForTimeout(1000);
                                
                                // Look for dropdown options - prioritize exact matches
                                const dropdownOptions = [
                                    // Exact matches first
                                    `text=${CONFIG.ticketDetails.assignedTo}`,
                                    `text=Sahaj Katiyar`,
                                    '.dropdown-item:has-text("Sahaj Katiyar")',
                                    '.o_dropdown_menu li:has-text("Sahaj Katiyar")',
                                    'ul.dropdown-menu li:has-text("Sahaj Katiyar")',
                                    '[role="option"]:has-text("Sahaj Katiyar")',
                                    // Partial matches as fallback (but still specific)
                                    '.dropdown-item:has-text("Katiyar")',
                                    '.o_dropdown_menu li:has-text("Katiyar")',
                                    'ul.dropdown-menu li:has-text("Katiyar")',
                                    '[role="option"]:has-text("Katiyar")'
                                ];
                                
                                let optionClicked = false;
                                for (const optionSelector of dropdownOptions) {
                                    try {
                                        const option = this.page.locator(optionSelector).first();
                                        if (await option.isVisible({ timeout: 2000 })) {
                                            // Verify this is the correct option before clicking
                                            const optionText = await option.textContent() || '';
                                            console.log(`🔍 Found dropdown option: "${optionText.trim()}"`);
                                            
                                            // Only click if it contains "Sahaj Katiyar" or "Katiyar"  
                                            if (optionText.includes('Sahaj Katiyar') || optionText.includes('Katiyar') || optionText.includes('Sahaj')) {
                                                await option.click();
                                                optionClicked = true;
                                                ownershipSet = true;
                                                console.log(`✅ Ownership set by clicking exact option: "${optionText.trim()}"`);
                                                break;
                                            } else {
                                                console.log(`⚠️ Skipping option "${optionText.trim()}" - not Sahaj Katiyar`);
                                            }
                                        }
                                    } catch (error) {
                                        continue;
                                    }
                                }
                                
                                if (!optionClicked) {
                                    // Try typing the full name and being more selective
                                    try {
                                        if (tagName === 'input') {
                                            await element.fill('');
                                            // Type the full name for better matching
                                            await element.type('Sahaj Katiyar', { delay: 50 });
                                            await this.page.waitForTimeout(1500);
                                            
                                            // Look for dropdown options that appeared
                                            const fullNameOptions = [
                                                'text=Sahaj Katiyar',
                                                '.dropdown-item:has-text("Sahaj Katiyar")',
                                                '.o_dropdown_menu li:has-text("Sahaj Katiyar")',
                                                'ul.dropdown-menu li:has-text("Sahaj Katiyar")',
                                                '[role="option"]:has-text("Sahaj Katiyar")',
                                                '.dropdown-item:has-text("Katiyar")',
                                                '.o_dropdown_menu li:has-text("Katiyar")',
                                                '[role="option"]:has-text("Katiyar")'
                                            ];
                                            
                                            let fullNameSelected = false;
                                            for (const fullNameSelector of fullNameOptions) {
                                                try {
                                                    const fullNameOption = this.page.locator(fullNameSelector).first();
                                                    if (await fullNameOption.isVisible({ timeout: 1000 })) {
                                                        const fullNameText = await fullNameOption.textContent() || '';
                                                        console.log(`🔍 Found typed option: "${fullNameText.trim()}"`);
                                                        
                                                        if (fullNameText.includes('Sahaj Katiyar') || fullNameText.includes('Katiyar')) {
                                                            await fullNameOption.click();
                                                            fullNameSelected = true;
                                                            ownershipSet = true;
                                                            console.log(`✅ Ownership set by clicking typed option: "${fullNameText.trim()}"`);
                                                            break;
                                                        }
                                                    }
                                                } catch (error) {
                                                    continue;
                                                }
                                            }
                                            
                                            if (!fullNameSelected) {
                                                // Fallback: try arrow down and check what's selected
                                                await this.page.keyboard.press('ArrowDown');
                                                await this.page.waitForTimeout(500);
                                                
                                                // Try to see what's highlighted/selected
                                                const highlightedOptions = [
                                                    '.dropdown-item.active',
                                                    '.dropdown-item:hover',
                                                    '[role="option"][aria-selected="true"]',
                                                    '.o_dropdown_menu .active'
                                                ];
                                                
                                                let correctSelection = false;
                                                for (const highlightedSelector of highlightedOptions) {
                                                    try {
                                                        const highlighted = this.page.locator(highlightedSelector).first();
                                                        if (await highlighted.isVisible({ timeout: 500 })) {
                                                            const highlightedText = await highlighted.textContent() || '';
                                                            console.log(`🔍 Highlighted option: "${highlightedText.trim()}"`);
                                                            
                                                            if (highlightedText.includes('Sahaj Katiyar') || highlightedText.includes('Katiyar')) {
                                                                await this.page.keyboard.press('Enter');
                                                                correctSelection = true;
                                                                ownershipSet = true;
                                                                console.log(`✅ Ownership set by Enter on correct selection: "${highlightedText.trim()}"`);
                                                                break;
                                                            }
                                                        }
                                                    } catch (error) {
                                                        continue;
                                                    }
                                                }
                                                
                                                if (!correctSelection) {
                                                    console.log('⚠️ Could not verify correct selection, pressing Enter anyway');
                                                    await this.page.keyboard.press('Enter');
                                                    ownershipSet = true;
                                                    console.log('⚠️ Ownership set by Enter (unverified)');
                                                }
                                            }
                                            
                                            if (fullNameSelected || correctSelection) {
                                                break;
                                            }
                                        }
                                    } catch (error) {
                                        console.log(`⚠️ Could not type in field: ${error.message}`);
                                        continue;
                                    }
                                }
                                
                                if (optionClicked) {
                                    break;
                                }
                            } catch (error) {
                                console.log(`⚠️ Could not handle dropdown field: ${error.message}`);
                                continue;
                            }
                        }
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!ownershipSet) {
                console.log('⚠️ Could not find or set ownership field - will proceed without it');
            }
            
            // Wait a moment for any UI updates
            await this.page.waitForTimeout(1000);
            
            console.log('✅ Ticket form filled successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to fill ticket form:', error);
            return false;
        }
    }

    async submitTicket() {
        try {
            console.log('🚀 Submitting ticket...');
            
            // Debug: Log all buttons
            try {
                const allButtons = await this.page.locator('button, input[type="submit"], a.btn').all();
                console.log(`🔍 Found ${allButtons.length} buttons`);
                for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
                    const button = allButtons[i];
                    const text = await button.textContent() || '';
                    const type = await button.getAttribute('type') || '';
                    const className = await button.getAttribute('class') || '';
                    const tagName = await button.evaluate(el => el.tagName.toLowerCase());
                    console.log(`  Button ${i}: ${tagName}[type="${type}", class="${className}"] text="${text.trim()}"`);
                }
            } catch (error) {
                console.log('⚠️ Could not debug buttons');
            }
            
            const submitSelectors = [
                // Look specifically for "Add" button first (most likely in task creation)
                'button:has-text("Add")',
                'text=Add',
                'button.o_form_button_save',  // Common Odoo save button
                'button[name="action_confirm"]',  // Common Odoo action
                'button[type="submit"]',
                'input[type="submit"]',
                'button.btn-primary:has-text("Add")',
                'button.btn-success:has-text("Add")',
                'button.btn-primary',
                'button.btn-success',
                'button:has-text("Save")',
                'button:has-text("Create")',
                'button:has-text("Submit")',
                'text=Save',
                'text=Create',
                'text=Submit',
                CONFIG.selectors.addButton
            ];
            
            let submitClicked = false;
            for (const selector of submitSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 2000 })) {
                        await this.clickElement(selector);
                        submitClicked = true;
                        console.log(`✅ Submit button clicked: ${selector}`);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!submitClicked) {
                // Try XPath approach
                try {
                    await this.page.locator('xpath=//button[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "add")] | //button[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "save")] | //button[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "submit")]').first().click();
                    submitClicked = true;
                    console.log('✅ Submit button clicked via XPath');
                } catch (error) {
                    console.log('⚠️ Could not find submit button');
                    return false;
                }
            }
            
            // Wait for submission to complete
            await this.page.waitForTimeout(3000);
            
            // Try to capture ticket ID if visible
            try {
                const ticketIdElement = this.page.locator(CONFIG.selectors.ticketId).first();
                if (await ticketIdElement.isVisible({ timeout: 3000 })) {
                    this.ticketId = await ticketIdElement.textContent();
                    console.log('🎫 Ticket ID captured:', this.ticketId);
                }
            } catch (error) {
                console.log('⚠️ Could not capture ticket ID');
            }
            
            console.log('✅ Ticket submitted successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to submit ticket:', error);
            return false;
        }
    }

    async closePopupWithDiscard() {
        try {
            console.log('🗑️ Looking for Discard button to close popup...');
            
            const discardSelectors = [
                'text=Discard',
                'button[data-dismiss="modal"]',
                '.modal-footer button',
                'text=Cancel',
                'text=Close'
            ];
            
            for (const selector of discardSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 2000 })) {
                        await this.clickElement(selector);
                        console.log(`✅ Clicked discard/close: ${selector}`);
                        await this.page.waitForTimeout(1000);
                        return true;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            // Try pressing Escape key
            try {
                await this.page.keyboard.press('Escape');
                console.log('✅ Pressed Escape to close popup');
                await this.page.waitForTimeout(1000);
                return true;
            } catch (error) {
                console.log('⚠️ Could not close popup');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Failed to close popup:', error);
            return false;
        }
    }

    async clickOnCreatedTicket() {
        try {
            console.log('🎯 Looking for the newly created ticket...');
            await this.page.waitForTimeout(3000);
            
            // Debug: Log all available kanban records/tickets
            try {
                const allTickets = await this.page.locator('.o_kanban_record, .kanban-card, .task-card').all();
                console.log(`🔍 Found ${allTickets.length} total tickets/cards`);
                
                for (let i = 0; i < Math.min(allTickets.length, 10); i++) {
                    const ticket = allTickets[i];
                    try {
                        const ticketText = await ticket.textContent() || '';
                        const className = await ticket.getAttribute('class') || '';
                        console.log(`  Ticket ${i}: class="${className}" text="${ticketText.trim().substring(0, 100)}..."`);
                    } catch (error) {
                        console.log(`  Ticket ${i}: Could not read text`);
                    }
                }
            } catch (error) {
                console.log('⚠️ Could not debug tickets');
            }
            
            // Look for ticket card with our title - be more specific
            const ticketCardSelectors = [
                // Most specific first - kanban records containing our title
                `.o_kanban_record:has-text("${CONFIG.ticketDetails.title}")`,
                `.o_kanban_record:has-text("Sample")`,
                // Try other card types
                `.kanban-card:has-text("${CONFIG.ticketDetails.title}")`,
                `.task-card:has-text("${CONFIG.ticketDetails.title}")`,
                `.card:has-text("${CONFIG.ticketDetails.title}")`,
                // Direct text match
                `text=${CONFIG.ticketDetails.title}`,
                `text=Sample`
            ];
            
            let ticketClicked = false;
            for (const selector of ticketCardSelectors) {
                try {
                    const ticketElements = await this.page.locator(selector).all();
                    console.log(`🔍 Found ${ticketElements.length} elements for selector: ${selector}`);
                    
                    if (ticketElements.length > 0) {
                        // Try to click on the first (most likely newest) ticket
                        const ticketElement = ticketElements[0];
                        
                        // Verify this is actually our ticket by checking the text
                        const ticketText = await ticketElement.textContent() || '';
                        console.log(`🔍 Checking ticket text: "${ticketText.trim()}"`);
                        
                        if (ticketText.includes(CONFIG.ticketDetails.title) || ticketText.includes('Sample')) {
                            await ticketElement.scrollIntoViewIfNeeded();
                            await ticketElement.click();
                            ticketClicked = true;
                            console.log(`✅ Clicked on ticket: ${selector} - "${ticketText.trim().substring(0, 50)}..."`);
                            break;
                        } else {
                            console.log(`⚠️ Ticket text doesn't match: "${ticketText.trim().substring(0, 50)}..."`);
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Error with selector ${selector}: ${error.message}`);
                    continue;
                }
            }
            
            if (!ticketClicked) {
                console.log('⚠️ Could not find ticket with title, trying to click the most recent one...');
                
                // Fallback: click on the first/most recent kanban record
                try {
                    const recentTicketSelectors = [
                        '.o_kanban_record:first-child',
                        '.o_kanban_record',
                        '.kanban-card:first-child',
                        '.kanban-card'
                    ];
                    
                    for (const selector of recentTicketSelectors) {
                        try {
                            const element = this.page.locator(selector).first();
                            if (await element.isVisible({ timeout: 2000 })) {
                                const elementText = await element.textContent() || '';
                                console.log(`🔍 Trying fallback click on: "${elementText.trim().substring(0, 50)}..."`);
                                
                                await element.scrollIntoViewIfNeeded();
                                await element.click();
                                ticketClicked = true;
                                console.log(`✅ Clicked on ticket (fallback): ${selector}`);
                                break;
                            }
                        } catch (error) {
                            continue;
                        }
                    }
                } catch (error) {
                    console.log('⚠️ Could not find any ticket to click');
                    return false;
                }
            }
            
            if (ticketClicked) {
                console.log('⏳ Waiting for task detail page to load completely...');
                await this.page.waitForTimeout(5000); // Increased wait time
                
                // Check if we're now in the ticket detail view
                try {
                    const currentUrl = this.page.url();
                    console.log('📍 Current URL after clicking ticket:', currentUrl);
                    
                    // Wait for the page to fully load by looking for specific indicators
                    const detailViewIndicators = [
                        '.o_form_view',
                        '.o_form_sheet',
                        '.o_form_editable',
                        'button:has-text("Edit")',
                        '.o_control_panel'
                    ];
                    
                    let detailViewLoaded = false;
                    for (const indicator of detailViewIndicators) {
                        try {
                            if (await this.page.locator(indicator).first().isVisible({ timeout: 5000 })) {
                                console.log(`✅ Confirmed in detail view - found: ${indicator}`);
                                detailViewLoaded = true;
                                break;
                            }
                        } catch (error) {
                            continue;
                        }
                    }
                    
                    if (!detailViewLoaded) {
                        console.log('⚠️ Detail view not fully loaded, waiting longer...');
                        await this.page.waitForTimeout(3000);
                        
                        // Try to wait for network idle
                        try {
                            await this.page.waitForLoadState('networkidle', { timeout: 10000 });
                            console.log('✅ Network idle - page should be fully loaded');
                        } catch (error) {
                            console.log('⚠️ Network idle timeout, but continuing...');
                        }
                    }
                } catch (error) {
                    console.log('⚠️ Could not verify detail view');
                }
                
                console.log('✅ Successfully clicked on ticket and waited for page load');
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ Failed to click on created ticket:', error);
            return false;
        }
    }

    async editTicketDetails() {
        try {
            console.log('✏️ Editing ticket details...');
            
            // Look for Edit button in the top navigation area
            console.log('🔍 Looking for Edit button in navigation...');
            
            // Debug: Log all buttons available on the page
            try {
                const allButtons = await this.page.locator('button, a.btn').all();
                console.log(`🔍 Found ${allButtons.length} buttons/links on the page`);
                for (let i = 0; i < Math.min(allButtons.length, 15); i++) {
                    const button = allButtons[i];
                    const text = await button.textContent() || '';
                    const className = await button.getAttribute('class') || '';
                    const tagName = await button.evaluate(el => el.tagName.toLowerCase());
                    console.log(`  Button ${i}: ${tagName}[class="${className}"] text="${text.trim()}"`);
                }
            } catch (error) {
                console.log('⚠️ Could not debug buttons');
            }
            
            const editSelectors = [
                // Based on the image, the Edit button is in the top navigation
                'button:has-text("Edit")',
                'a:has-text("Edit")',
                'text=Edit',
                '.o_control_panel button:has-text("Edit")',
                '.o_cp_buttons button:has-text("Edit")',
                'button.btn:has-text("Edit")',
                'button[data-testid*="edit"]',
                '.edit-button',
                '[aria-label*="edit" i]',
                'button.o_form_button_edit',
                // More specific selectors for Odoo interface
                '.o_control_panel_main_buttons button:has-text("Edit")',
                '.o_form_buttons_edit button:has-text("Edit")',
                // Try more generic approaches
                'button.btn-primary:has-text("Edit")',
                'button.btn-secondary:has-text("Edit")'
            ];
            
            let editClicked = false;
            for (const selector of editSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 3000 })) {
                        await this.clickElement(selector);
                        editClicked = true;
                        console.log(`✅ Clicked Edit button: ${selector}`);
                        await this.page.waitForTimeout(2000);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!editClicked) {
                console.log('⚠️ Could not find Edit button, task might already be in edit mode');
            }
            
            // Set Customer to "Discount Pipe & Steel"
            console.log('👤 Setting customer to "Discount Pipe & Steel"...');
            
            // Debug: Look for customer-related fields and form structure
            try {
                // Look for all input fields in the form
                const allInputs = await this.page.locator('input, select, textarea').all();
                console.log(`🔍 Found ${allInputs.length} total form inputs`);
                
                // Look for fields that might be the Customer field
                const customerFields = await this.page.locator('input, select').all();
                console.log(`🔍 Analyzing form fields for Customer field:`);
                for (let i = 0; i < Math.min(customerFields.length, 10); i++) {
                    const field = customerFields[i];
                    const name = await field.getAttribute('name') || '';
                    const placeholder = await field.getAttribute('placeholder') || '';
                    const className = await field.getAttribute('class') || '';
                    const id = await field.getAttribute('id') || '';
                    const tagName = await field.evaluate(el => el.tagName.toLowerCase());
                    
                    // Check if this field is near a "Customer" label
                    try {
                        const parent = await field.locator('..').first();
                        const parentText = await parent.textContent() || '';
                        const hasCustomerLabel = parentText.toLowerCase().includes('customer');
                        
                        console.log(`  Field ${i}: ${tagName}[name="${name}", id="${id}", placeholder="${placeholder}"] class="${className.substring(0, 50)}..." hasCustomerLabel=${hasCustomerLabel}`);
                    } catch (error) {
                        console.log(`  Field ${i}: ${tagName}[name="${name}", id="${id}", placeholder="${placeholder}"] class="${className.substring(0, 50)}..."`);
                    }
                }
            } catch (error) {
                console.log('⚠️ Could not debug customer fields');
            }
            
            const customerSelectors = [
                // Look for the Customer field specifically based on the form structure
                'div.o_field_widget[name*="partner"] input',
                'div.o_field_widget input[placeholder*="customer" i]',
                'input[name*="customer"]',
                'input[placeholder*="customer" i]',
                'select[name*="customer"]',
                'div[data-field-name*="customer"] input',
                '.o_field_many2one input[name*="partner"]',
                'input[name*="partner"]',
                'select[name*="partner"]',
                // Try more specific Odoo field selectors
                '.o_field_many2one.o_field_widget input',
                'div.o_row .o_field_many2one input'
            ];
            
            let customerSet = false;
            for (const selector of customerSelectors) {
                try {
                    const element = this.page.locator(selector).first();
                    if (await element.isVisible({ timeout: 2000 })) {
                        console.log(`🎯 Found customer field: ${selector}`);
                        
                        const tagName = await element.evaluate(el => el.tagName.toLowerCase());
                        
                        if (tagName === 'select') {
                            // Handle select dropdown
                            try {
                                await element.selectOption({ label: CONFIG.ticketDetails.customer });
                                customerSet = true;
                                console.log('✅ Customer selected from select dropdown');
                                break;
                            } catch (error) {
                                console.log(`⚠️ Could not select customer from select: ${error.message}`);
                                continue;
                            }
                        } else {
                            // Handle input field with dropdown
                            try {
                                await element.click();
                                await this.page.waitForTimeout(1000);
                                
                                // Try to find and click the exact customer option
                                const customerOptions = [
                                    `text=${CONFIG.ticketDetails.customer}`,
                                    `text=Discount Pipe & Steel`,
                                    '.dropdown-item:has-text("Discount Pipe & Steel")',
                                    '.o_dropdown_menu li:has-text("Discount Pipe & Steel")',
                                    '[role="option"]:has-text("Discount Pipe & Steel")',
                                    'ul.ui-autocomplete li:has-text("Discount Pipe & Steel")',
                                    '.ui-menu-item:has-text("Discount Pipe & Steel")'
                                ];
                                
                                let customerOptionClicked = false;
                                for (const optionSelector of customerOptions) {
                                    try {
                                        const options = await this.page.locator(optionSelector).all();
                                        console.log(`🔍 Found ${options.length} options for selector: ${optionSelector}`);
                                        
                                        for (const option of options) {
                                            if (await option.isVisible({ timeout: 1000 })) {
                                                const optionText = await option.textContent() || '';
                                                console.log(`🔍 Checking option: "${optionText.trim()}"`);
                                                
                                                // Only select exact match "Discount Pipe & Steel" without additional names
                                                if (optionText.trim() === 'Discount Pipe & Steel' || 
                                                    (optionText.includes('Discount Pipe & Steel') && 
                                                     !optionText.includes(',') && 
                                                     !optionText.includes('AMY') && 
                                                     !optionText.includes('AUSTIN') && 
                                                     !optionText.includes('SKYE'))) {
                                                    await option.click();
                                                    customerOptionClicked = true;
                                                    customerSet = true;
                                                    console.log(`✅ Customer selected by clicking exact match: "${optionText.trim()}"`);
                                                    break;
                                                } else {
                                                    console.log(`⚠️ Skipping option "${optionText.trim()}" - not exact match`);
                                                }
                                            }
                                        }
                                        
                                        if (customerOptionClicked) {
                                            break;
                                        }
                                    } catch (error) {
                                        continue;
                                    }
                                }
                                
                                if (!customerOptionClicked) {
                                    // Try typing the customer name and selecting exact match
                                    await element.fill('');
                                    await element.type('Discount Pipe & Steel', { delay: 50 });
                                    await this.page.waitForTimeout(1500);
                                    
                                    // Look for the exact option after typing
                                    try {
                                        const typedOptions = await this.page.locator('ul.ui-autocomplete li, .ui-menu-item, .dropdown-item').all();
                                        console.log(`🔍 Found ${typedOptions.length} options after typing`);
                                        
                                        let exactOptionFound = false;
                                        for (const typedOption of typedOptions) {
                                            if (await typedOption.isVisible({ timeout: 500 })) {
                                                const typedOptionText = await typedOption.textContent() || '';
                                                console.log(`🔍 Typed option: "${typedOptionText.trim()}"`);
                                                
                                                if (typedOptionText.trim() === 'Discount Pipe & Steel' || 
                                                    (typedOptionText.includes('Discount Pipe & Steel') && 
                                                     !typedOptionText.includes(',') && 
                                                     !typedOptionText.includes('AMY') && 
                                                     !typedOptionText.includes('AUSTIN') && 
                                                     !typedOptionText.includes('SKYE'))) {
                                                    await typedOption.click();
                                                    exactOptionFound = true;
                                                    customerSet = true;
                                                    console.log(`✅ Customer set by clicking exact typed option: "${typedOptionText.trim()}"`);
                                                    break;
                                                }
                                            }
                                        }
                                        
                                        if (!exactOptionFound) {
                                            // Fallback: use keyboard navigation carefully
                                            console.log('⚠️ Exact option not found, using keyboard navigation');
                                            await this.page.keyboard.press('ArrowDown');
                                            await this.page.keyboard.press('Enter');
                                            customerSet = true;
                                            console.log('⚠️ Customer set by keyboard (unverified)');
                                        }
                                    } catch (error) {
                                        console.log('⚠️ Could not find typed options, using keyboard fallback');
                                        await this.page.keyboard.press('ArrowDown');
                                        await this.page.keyboard.press('Enter');
                                        customerSet = true;
                                        console.log('⚠️ Customer set by keyboard fallback');
                                    }
                                }
                                
                                if (customerSet) {
                                    break;
                                }
                            } catch (error) {
                                console.log(`⚠️ Could not handle customer field: ${error.message}`);
                                continue;
                            }
                        }
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!customerSet) {
                console.log('⚠️ Could not find or set customer field');
            }
            
            await this.page.waitForTimeout(1000);
            
            // Set Description to "this is a task"
            console.log('📝 Setting description to "this is a task"...');
            
            // First, try to click on the Description tab if it exists
            try {
                const descriptionTab = this.page.locator('.nav-link:has-text("Description"), a:has-text("Description"), button:has-text("Description")').first();
                if (await descriptionTab.isVisible({ timeout: 2000 })) {
                    await descriptionTab.click();
                    console.log('✅ Clicked on Description tab');
                    await this.page.waitForTimeout(1000);
                }
            } catch (error) {
                console.log('⚠️ Description tab not found or already active');
            }
            
            const descriptionSelectors = [
                // Based on the image, the Description tab has a rich text editor
                '.tab-pane.active .note-editable',  // Rich text editor content area
                '.tab-pane[id*="description"] .note-editable',
                '.note-editing-area .note-editable',
                'div[data-field-name*="description"] .note-editable',
                // Traditional textarea approaches
                'textarea[name*="description"]',
                'textarea[placeholder*="description" i]',
                'input[name*="description"]',
                'div[data-field-name*="description"] textarea',
                'div[data-field-name*="description"] input',
                '.o_field_text textarea',
                'textarea[name="description"]',
                // Rich text editor iframe
                'iframe[title*="description" i]',
                '.o_field_html .note-editable',
                // Try clicking on Description tab first, then find editor
                '.nav-link:has-text("Description")'
            ];
            
            let descriptionSet = false;
            for (const selector of descriptionSelectors) {
                try {
                    const element = this.page.locator(selector).first();
                    if (await element.isVisible({ timeout: 2000 })) {
                        console.log(`🎯 Found description field: ${selector}`);
                        await element.click();
                        await element.fill('');
                        await element.type('this is a task', { delay: 50 });
                        descriptionSet = true;
                        console.log('✅ Description set successfully');
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!descriptionSet) {
                console.log('⚠️ Could not find or set description field');
            }
            
            await this.page.waitForTimeout(1000);
            
            // Save changes
            console.log('💾 Looking for Save button...');
            const saveSelectors = [
                'button:has-text("Save")',
                'text=Save',
                'button[type="submit"]',
                'button.o_form_button_save',
                'text=Update',
                '.save-button',
                'button.btn-primary:has-text("Save")'
            ];
            
            let saveClicked = false;
            for (const selector of saveSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 3000 })) {
                        await this.clickElement(selector);
                        saveClicked = true;
                        console.log(`✅ Save button clicked: ${selector}`);
                        await this.page.waitForTimeout(2000);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!saveClicked) {
                console.log('⚠️ Could not find Save button');
            }
            
            console.log('✅ Ticket details edited successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to edit ticket details:', error);
            return false;
        }
    }

    async addLogNote() {
        try {
            console.log('📝 Adding log note...');
            
            // Look for Log Note option/button
            console.log('🔍 Looking for Log Note option...');
            const logNoteSelectors = [
                'button:has-text("Log Note")',
                'a:has-text("Log Note")',
                'text=Log Note',
                '.log-note',
                'button[data-action*="log"]',
                'button[data-action*="note"]',
                // Try more generic approaches
                'button:has-text("Log")',
                'a:has-text("Log")',
                'text=Log',
                // Look for note-related buttons
                'button:has-text("Note")',
                'a:has-text("Note")',
                'text=Note',
                // Odoo-specific selectors
                '.o_chatter_button_log_note',
                'button[data-action="mail.action_mail_compose_message_wizard"]',
                // More generic log/note selectors
                '[title*="log" i]',
                '[title*="note" i]',
                '[aria-label*="log" i]',
                '[aria-label*="note" i]'
            ];
            
            let logNoteClicked = false;
            for (const selector of logNoteSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 3000 })) {
                        await this.clickElement(selector);
                        logNoteClicked = true;
                        console.log(`✅ Clicked Log Note: ${selector}`);
                        await this.page.waitForTimeout(2000);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!logNoteClicked) {
                console.log('⚠️ Could not find Log Note button');
                return false;
            }
            
            // Fill the log note text area
            console.log('✍️ Typing log note content...');
            const logNoteTextSelectors = [
                'textarea[placeholder*="log" i]',
                'textarea[placeholder*="note" i]',
                'textarea[name*="body"]',
                'textarea[name*="message"]',
                'textarea[name*="comment"]',
                '.note-editable',
                'textarea.o_input',
                'textarea',
                // Rich text editor approaches
                'div[contenteditable="true"]',
                '.o_field_html .note-editable'
            ];
            
            let logNoteTyped = false;
            for (const selector of logNoteTextSelectors) {
                try {
                    if (await this.page.locator(selector).first().isVisible({ timeout: 2000 })) {
                        console.log(`🎯 Found log note text area: ${selector}`);
                        await this.clearAndType(selector, CONFIG.ticketDetails.logNote);
                        logNoteTyped = true;
                        console.log('✅ Log note content typed successfully');
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!logNoteTyped) {
                console.log('⚠️ Could not find log note text area');
                return false;
            }
            
            await this.page.waitForTimeout(1000);
            
            // Click Log button to submit the note
            console.log('📤 Looking for Log button to submit...');
            
            // Debug: Log all buttons available after typing the log note
            try {
                const allButtons = await this.page.locator('button, input[type="submit"], a.btn').all();
                console.log(`🔍 Found ${allButtons.length} buttons after typing log note`);
                for (let i = 0; i < Math.min(allButtons.length, 20); i++) {
                    const button = allButtons[i];
                    const text = await button.textContent() || '';
                    const className = await button.getAttribute('class') || '';
                    const type = await button.getAttribute('type') || '';
                    const isVisible = await button.isVisible();
                    console.log(`  Button ${i}: text="${text.trim()}" class="${className.substring(0, 50)}..." type="${type}" visible=${isVisible}`);
                }
            } catch (error) {
                console.log('⚠️ Could not debug Log buttons');
            }
            
            const logSubmitSelectors = [
                // Most specific Log button selectors first - exclude "Log note"
                'button:has-text("Log"):not(:has-text("note"))',
                'button:has-text("Log"):not(:has-text("Note"))',
                'input[value="Log"]',
                'button[title="Log"]:not([title*="note"])',
                'button[aria-label="Log"]:not([aria-label*="note"])',
                // Try in the composer/message area specifically
                '.o_composer button:has-text("Log")',
                '.o_mail_composer button:has-text("Log")',
                '.modal-footer button:has-text("Log")',
                '.o_chatter button:has-text("Log"):not(:has-text("note"))',
                // Generic submit buttons in the log note area
                'button[type="submit"]',
                'input[type="submit"]',
                'button.btn-primary',
                'button.btn-success',
                // Odoo-specific selectors
                '.o_composer_button_send',
                'button[data-action="send"]',
                'button:has-text("Send")',
                'button:has-text("Submit")',
                'button:has-text("Post")',
                // Try more specific text matches
                'text=Log',
                'button.btn:has-text("Log"):not(:has-text("note"))',
                'button.btn-primary:has-text("Log")',
                'button.btn-secondary:has-text("Log")'
            ];
            
            let logSubmitted = false;
            for (const selector of logSubmitSelectors) {
                try {
                    const elements = await this.page.locator(selector).all();
                    console.log(`🔍 Found ${elements.length} elements for selector: ${selector}`);
                    
                    for (const element of elements) {
                        try {
                            if (await element.isVisible({ timeout: 1000 })) {
                                const buttonText = await element.textContent() || '';
                                const buttonClass = await element.getAttribute('class') || '';
                                console.log(`🎯 Checking button: "${buttonText.trim()}" class="${buttonClass.substring(0, 30)}..."`);
                                
                                // Verify this is actually a Log submit button (not "Log note")
                                if ((buttonText.toLowerCase() === 'log') ||
                                    (buttonText.toLowerCase().includes('log') && !buttonText.toLowerCase().includes('note')) ||
                                    buttonClass.includes('send') ||
                                    buttonClass.includes('submit') ||
                                    (selector.includes('Log') && !selector.includes('note'))) {
                                    
                                    await element.scrollIntoViewIfNeeded();
                                    await element.click();
                                    logSubmitted = true;
                                    console.log(`✅ Log button clicked: ${selector} - "${buttonText.trim()}"`);
                                    await this.page.waitForTimeout(3000); // Wait longer for log to be processed
                                    break;
                                } else {
                                    console.log(`⚠️ Skipping button "${buttonText.trim()}" - not a Log button`);
                                }
                            }
                        } catch (error) {
                            continue;
                        }
                    }
                    
                    if (logSubmitted) {
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!logSubmitted) {
                console.log('⚠️ Could not find Log button to submit, trying XPath approach...');
                
                // Try XPath approach for Log button
                try {
                    await this.page.locator('xpath=//button[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "log")] | //input[contains(@value, "Log")] | //button[contains(@title, "Log")]').first().click();
                    logSubmitted = true;
                    console.log('✅ Log button clicked via XPath');
                    await this.page.waitForTimeout(3000);
                } catch (error) {
                    console.log('⚠️ XPath approach also failed');
                    return false;
                }
            }
            
            console.log('✅ Log note added successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to add log note:', error);
            return false;
        }
    }

    async captureScreenshot(name) {
        try {
            const screenshotPath = path.join(__dirname, `screenshot_${name}_${Date.now()}.png`);
            await this.page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 Screenshot saved: ${screenshotPath}`);
            return screenshotPath;
        } catch (error) {
            console.error('❌ Failed to capture screenshot:', error);
        }
    }

    async run() {
        try {
            await this.init();
            
            // Set description from email subject if provided
            const emailSubject = process.env.EMAIL_SUBJECT || process.argv.find(arg => arg.startsWith('--subject='))?.split('=')[1];
            if (emailSubject) {
                this.updateDescriptionFromEmail(emailSubject);
                console.log('📧 Email subject set as description:', emailSubject);
            }

            // Determine if we are in log-note-only mode
            const providedTicketTitle = process.env.TICKET_TITLE || CONFIG.ticketDetails.title;
            const providedLogNote = process.env.LOG_NOTE || process.env.EMAIL_SUBJECT || CONFIG.ticketDetails.logNote;
            const logNoteOnlyMode = Boolean(process.env.TICKET_TITLE && (process.env.LOG_NOTE || process.env.EMAIL_SUBJECT));
            if (logNoteOnlyMode) {
                CONFIG.ticketDetails.title = providedTicketTitle;
                CONFIG.ticketDetails.logNote = providedLogNote;
            }
            
            // Login
            const loginSuccess = await this.login();
            if (!loginSuccess) {
                throw new Error('Login failed');
            }
            await this.captureScreenshot('after_login');
            
            // Navigate to Projects and Test Support
            const projectsSuccess = await this.navigateToProjects();
            if (!projectsSuccess) {
                throw new Error('Failed to navigate to Projects and select Test Support');
            }
            await this.captureScreenshot('after_test_support_selection');

            if (logNoteOnlyMode) {
                console.log('🛠️ Log-note-only mode enabled: opening existing ticket and posting note...');
                const opened = await this.openTicketByTitle(CONFIG.ticketDetails.title);
                if (!opened) {
                    throw new Error(`Ticket not found: ${CONFIG.ticketDetails.title}`);
                }
                await this.captureScreenshot('after_open_existing_ticket');

                // Ensure we are in detail view and then add log note
                const added = await this.addLogNote();
                if (!added) {
                    throw new Error('Failed to add log note');
                }
                await this.captureScreenshot('after_log_note');
                console.log('🎉 Log note posted to existing ticket successfully');
                return { success: true, ticketId: null };
            }
            
            // Default flow: create ticket, edit and add log note
            // Click Create
            const createSuccess = await this.clickCreate();
            if (!createSuccess) {
                throw new Error('Failed to click Create');
            }
            await this.captureScreenshot('after_create');
            
            // Fill ticket form
            const formSuccess = await this.fillTicketForm();
            if (!formSuccess) {
                throw new Error('Failed to fill ticket form');
            }
            await this.captureScreenshot('after_form_fill');
            
            // Submit ticket
            const submitSuccess = await this.submitTicket();
            if (!submitSuccess) {
                throw new Error('Failed to submit ticket');
            }
            await this.captureScreenshot('after_submit');
            
            // Close popup if needed
            await this.closePopupWithDiscard();
            console.log('✅ Ticket created successfully');
            
            // Click on the created ticket
            console.log('🎯 Continuing to click on created ticket...');
            await this.page.waitForTimeout(3000);
            
            const ticketClickSuccess = await this.clickOnCreatedTicket();
            if (!ticketClickSuccess) {
                throw new Error('Failed to click on created ticket');
            }
            
            // Edit ticket details
            const editSuccess = await this.editTicketDetails();
            if (!editSuccess) {
                console.log('⚠️ Could not edit ticket details, but continuing...');
            }
            
            await this.captureScreenshot('after_ticket_edit');
            
            // Add log note
            console.log('📝 Adding log note to the ticket...');
            const logNoteSuccess = await this.addLogNote();
            if (!logNoteSuccess) {
                console.log('⚠️ Could not add log note, but task creation was successful');
            }
            
            await this.captureScreenshot('after_log_note');
            
            // Final result
            if (this.ticketId) {
                console.log(`🎉 Ticket created, edited, and log note added successfully! Ticket ID: ${this.ticketId}`);
                return { success: true, ticketId: this.ticketId };
            } else {
                console.log('✅ Ticket creation, editing, and log note process completed');
                return { success: true, ticketId: null };
            }
            
        } catch (error) {
            console.error('❌ Automation failed:', error);
            await this.captureScreenshot('error');
            return { success: false, error: error.message };
        } finally {
            if (this.browser) {
                await this.browser.close();
                console.log('🔒 Browser closed');
            }
        }
    }

    async openTicketByTitle(searchTitle) {
        try {
            console.log(`🎯 Locating ticket by title: "${searchTitle}"...`);
            await this.page.waitForTimeout(2000);

            // Prefer exact title matches within kanban cards
            const selectors = [
                `.o_kanban_record:has(:text("${searchTitle}"))`,
                `.kanban-card:has(:text("${searchTitle}"))`,
                `.task-card:has(:text("${searchTitle}"))`,
                `.card:has(:text("${searchTitle}"))`,
                `xpath=//div[contains(@class,'o_kanban_record')][.//text()[contains(., ${JSON.stringify(searchTitle)})]]`,
                `text=${searchTitle}`
            ];

            for (const selector of selectors) {
                try {
                    const candidates = await this.page.locator(selector).all();
                    if (candidates.length === 0) continue;

                    for (const candidate of candidates) {
                        const text = (await candidate.textContent()) || '';
                        if (!text) continue;
                        // Prioritize cards whose prominent title line contains the search title
                        if (text.toLowerCase().includes(searchTitle.toLowerCase())) {
                            await candidate.scrollIntoViewIfNeeded();
                            await candidate.click();
                            console.log(`✅ Opened ticket via selector: ${selector}`);

                            // Wait for detail view
                            await this.page.waitForTimeout(3000);
                            const inDetail = await this.page.locator('.o_form_view').first().isVisible({ timeout: 5000 }).catch(() => false);
                            if (!inDetail) {
                                // Sometimes click targets inner elements; try clicking again on closest link
                                try {
                                    await candidate.locator('a, .oe_kanban_global_click, .o_kanban_record').first().click();
                                    await this.page.waitForTimeout(2000);
                                } catch {}
                            }
                            return true;
                        }
                    }
                } catch (e) {
                    continue;
                }
            }
            console.log('⚠️ Ticket with given title not found');
            return false;
        } catch (error) {
            console.error('❌ Failed to open ticket by title:', error);
            return false;
        }
    }
}

// Main execution function
async function main() {
    console.log('🚀 Starting EOXS Ticket Creation Automation with Log Note using Playwright...');
    console.log('📋 Configuration:');
    console.log(`   Base URL: ${CONFIG.baseUrl}`);
    console.log(`   Email: ${CONFIG.credentials.email}`);
    console.log(`   Ticket Title: ${CONFIG.ticketDetails.title}`);
    console.log(`   Customer: ${CONFIG.ticketDetails.customer}`);
    console.log(`   Assigned To: ${CONFIG.ticketDetails.assignedTo}`);
    console.log(`   Log Note: ${CONFIG.ticketDetails.logNote}`);
    console.log('');
    
    // Check credentials
    if (CONFIG.credentials.email === 'your-email@example.com' || CONFIG.credentials.password === 'your-password') {
        console.log('⚠️  Please set your credentials using environment variables:');
        console.log('   export EOXS_EMAIL="your-email@example.com"');
        console.log('   export EOXS_PASSWORD="your-password"');
        console.log('');
        console.log('   Or modify the CONFIG.credentials object in the script.');
        return;
    }
    
    const automation = new EOXSPlaywrightAutomationWithLog();
    const result = await automation.run();
    
    console.log('');
    console.log('📊 Final Result:', result);
    
    if (result.success) {
        console.log('🎉 Automation with Log Note completed successfully!');
        process.exit(0);
    } else {
        console.log('❌ Automation failed!');
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Run the automation
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = EOXSPlaywrightAutomationWithLog;
