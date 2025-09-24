# EOXS Log Automation

An automated ticket creation and log note posting system for EOXS platform using Playwright. This script can create new tickets with log notes or add log notes to existing tickets.

## Features

- 🔐 **Automated Login**: Handles EOXS authentication with environment variables
- 🎫 **Ticket Creation**: Creates new tickets with customizable title, customer, and description
- 📝 **Log Note Posting**: Adds log notes to existing tickets or newly created ones
- 🎯 **Dual Mode Operation**: Supports both ticket creation and log-note-only modes
- 📸 **Debug Support**: Captures screenshots at key points for troubleshooting
- 🛡️ **Robust Error Handling**: Comprehensive error handling with graceful fallbacks
- 🚀 **Railway Ready**: Optimized for deployment on Railway platform
- 🔗 **N8N Integration**: Perfect for workflow automation with N8N

## Quick Start

### Prerequisites
- Node.js 16 or higher
- Valid EOXS credentials

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/eoxs-log-automation.git
cd eoxs-log-automation
```

2. Install dependencies:
```bash
npm install
npx playwright install chromium
```

3. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your EOXS credentials
```

4. Run the automation:
```bash
npm start
```

## Usage Modes

### 1. Ticket Creation Mode (Default)
Creates a new ticket and adds a log note:

```bash
# Using environment variables
EMAIL_SUBJECT="New Support Request" EMAIL_CUSTOMER="Customer Name" EMAIL_BODY="Issue description" npm start

# Or set in .env file
EMAIL_SUBJECT=New Support Request
EMAIL_CUSTOMER=Customer Name
EMAIL_BODY=Issue description
```

### 2. Log Note Only Mode
Adds a log note to an existing ticket:

```bash
# Using environment variables
TICKET_TITLE="Existing Ticket Title" LOG_NOTE="This is a log note" npm start

# Or set in .env file
TICKET_TITLE=Existing Ticket Title
LOG_NOTE=This is a log note
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Required: EOXS Login Credentials
EOXS_EMAIL=your.email@example.com
EOXS_PASSWORD=your_password_here

# Browser Configuration
HEADLESS=true

# Ticket Creation Mode
EMAIL_SUBJECT=Your ticket title here
EMAIL_CUSTOMER=Customer Name
EMAIL_BODY=Description or log note content

# Log Note Only Mode (for existing tickets)
TICKET_TITLE=Existing Ticket Title
LOG_NOTE=Log note content to post

# Optional Settings
EOXS_BASE_URL=https://teams.eoxs.com/
NODE_ENV=production
```

### Script Configuration

You can also modify the configuration directly in `eoxs_playwright_automation_with_log.js`:

```javascript
const CONFIG = {
    baseUrl: 'https://teams.eoxs.com/',
    credentials: {
        email: process.env.EOXS_EMAIL || 'your.email@example.com',
        password: process.env.EOXS_PASSWORD || 'your_password'
    },
    ticketDetails: {
        title: 'Sample',
        customer: 'Discount Pipe & Steel',
        assignedTo: 'Sahaj Katiyar',
        description: '',
        logNote: 'Email received from customer',
    },
    browser: {
        headless: process.env.NODE_ENV === 'production' || process.env.HEADLESS === 'true',
        slowMo: 100
    }
};
```

## N8N Integration

This script is designed to work seamlessly with N8N workflows. Use the following environment variable mapping:

### For Ticket Creation:
- `EMAIL_SUBJECT` → Ticket title
- `EMAIL_CUSTOMER` → Customer name
- `EMAIL_BODY` → Description/log note

### For Log Note Only:
- `TICKET_TITLE` → Existing ticket title
- `LOG_NOTE` → Log note content

## Deployment

### Railway Deployment

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard:
   - `EOXS_EMAIL`
   - `EOXS_PASSWORD`
   - `HEADLESS=true`
   - `NODE_ENV=production`
3. Deploy automatically on push

### Docker

Build and run with Docker:

```bash
docker build -t eoxs-log-automation .
docker run --env-file .env eoxs-log-automation
```

### Manual Deployment

```bash
# Install dependencies
npm install
npx playwright install chromium

# Set environment variables
export EOXS_EMAIL="your.email@example.com"
export EOXS_PASSWORD="your_password"
export HEADLESS="true"

# Run the script
npm start
```

## Output

The script generates:

1. **Console Output**: Real-time progress and operation results
2. **Screenshots**: `screenshot_[name]_[timestamp].png` for debugging
3. **Success/Error Status**: Returns JSON with operation status

### Example Output

```json
{
  "success": true,
  "ticketId": "12345",
  "message": "Ticket created and log note added successfully"
}
```

## Troubleshooting

### Common Issues

1. **Login Failed**: Verify your credentials in `.env` file
2. **Ticket Not Found**: Ensure the ticket title exists in the Test Support project
3. **Element Not Found**: The UI might have changed; check screenshots for debugging
4. **Browser Issues**: Try running with `HEADLESS=false` to see what's happening

### Debug Mode

Run with debug mode enabled:

```bash
HEADLESS=false npm start
```

This will:
- Show the browser window
- Capture screenshots at key points
- Provide detailed console logging

### Screenshots

The script automatically captures screenshots at key points:
- `after_login` - After successful login
- `after_test_support_selection` - After navigating to Test Support
- `after_create` - After clicking create button
- `after_form_fill` - After filling the form
- `after_submit` - After submitting the ticket
- `after_ticket_edit` - After editing ticket details
- `after_log_note` - After adding log note
- `error` - If an error occurs

## Script Structure

```
eoxs_playwright_automation_with_log.js
├── Configuration
├── EOXSPlaywrightAutomationWithLog Class
│   ├── init() - Browser setup
│   ├── login() - Authentication
│   ├── navigateToProjects() - Navigation to Test Support
│   ├── clickCreate() - Create new ticket
│   ├── fillTicketForm() - Fill ticket details
│   ├── submitTicket() - Submit ticket
│   ├── openTicketByTitle() - Open existing ticket
│   ├── editTicketDetails() - Edit ticket details
│   ├── addLogNote() - Add log note
│   └── run() - Main execution logic
└── Main execution
```

## API Integration

The script can be triggered via HTTP requests when deployed on Railway:

```bash
# Create ticket
curl -X POST https://your-railway-app.railway.app \
  -H "Content-Type: application/json" \
  -d '{
    "EMAIL_SUBJECT": "New Support Request",
    "EMAIL_CUSTOMER": "Customer Name",
    "EMAIL_BODY": "Issue description"
  }'

# Add log note to existing ticket
curl -X POST https://your-railway-app.railway.app \
  -H "Content-Type: application/json" \
  -d '{
    "TICKET_TITLE": "Existing Ticket",
    "LOG_NOTE": "This is a log note"
  }'
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review screenshots for debugging information