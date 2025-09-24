# Deployment Guide

This guide covers deploying the EOXS Log Automation to Railway platform.

## Railway Deployment

### Prerequisites
- GitHub repository with the code
- Railway account
- EOXS credentials

### Step 1: Connect to Railway

1. Go to [Railway.app](https://railway.app)
2. Sign in with your GitHub account
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository

### Step 2: Configure Environment Variables

In the Railway dashboard, go to your project and add these environment variables:

#### Required Variables:
```
EOXS_EMAIL=your.email@example.com
EOXS_PASSWORD=your_password_here
NODE_ENV=production
HEADLESS=true
```

#### Optional Variables (for automation):
```
EMAIL_SUBJECT=Default ticket title
EMAIL_CUSTOMER=Default customer name
EMAIL_BODY=Default description
TICKET_TITLE=Default existing ticket title
LOG_NOTE=Default log note
```

### Step 3: Deploy

Railway will automatically:
1. Build the Docker container
2. Install dependencies
3. Install Playwright browsers
4. Start the server

### Step 4: Test the Deployment

Once deployed, you can test the service:

```bash
# Health check
curl https://your-app.railway.app/health

# Create a ticket
curl -X POST https://your-app.railway.app/automate \
  -H "Content-Type: application/json" \
  -d '{
    "EMAIL_SUBJECT": "Test Ticket",
    "EMAIL_CUSTOMER": "Test Customer",
    "EMAIL_BODY": "Test description"
  }'

# Add log note to existing ticket
curl -X POST https://your-app.railway.app/automate \
  -H "Content-Type: application/json" \
  -d '{
    "TICKET_TITLE": "Existing Ticket",
    "LOG_NOTE": "This is a test log note"
  }'
```

## N8N Integration

### HTTP Request Node Configuration

1. **Method**: POST
2. **URL**: `https://your-app.railway.app/automate`
3. **Headers**: 
   ```
   Content-Type: application/json
   ```
4. **Body** (for ticket creation):
   ```json
   {
     "EMAIL_SUBJECT": "{{ $json.subject }}",
     "EMAIL_CUSTOMER": "{{ $json.customer }}",
     "EMAIL_BODY": "{{ $json.description }}"
   }
   ```
5. **Body** (for log note only):
   ```json
   {
     "TICKET_TITLE": "{{ $json.ticketTitle }}",
     "LOG_NOTE": "{{ $json.logNote }}"
   }
   ```

### Example N8N Workflow

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "eoxs-automation",
        "httpMethod": "POST"
      }
    },
    {
      "name": "EOXS Automation",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://your-app.railway.app/automate",
        "method": "POST",
        "headers": {
          "Content-Type": "application/json"
        },
        "body": {
          "EMAIL_SUBJECT": "{{ $json.subject }}",
          "EMAIL_CUSTOMER": "{{ $json.customer }}",
          "EMAIL_BODY": "{{ $json.description }}"
        }
      }
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "EOXS Automation",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## Monitoring and Logs

### Railway Logs
- Go to your Railway project dashboard
- Click on "Deployments" tab
- View logs for debugging

### Health Monitoring
The service provides a health check endpoint:
```
GET https://your-app.railway.app/health
```

### Screenshots
Screenshots are captured during automation and stored in the container. For debugging, you can:
1. Check Railway logs for screenshot paths
2. Modify the script to upload screenshots to a cloud storage service

## Troubleshooting

### Common Issues

1. **Build Fails**: Check that all dependencies are in package.json
2. **Runtime Errors**: Check Railway logs for detailed error messages
3. **Login Issues**: Verify EOXS credentials are correct
4. **Timeout Issues**: Increase timeout values in the script

### Debug Mode

To enable debug mode, set:
```
HEADLESS=false
NODE_ENV=development
```

This will show the browser window and provide more detailed logging.

### Scaling

Railway automatically handles scaling, but you can:
1. Set resource limits in Railway dashboard
2. Configure auto-scaling based on traffic
3. Use Railway's monitoring tools

## Security Considerations

1. **Environment Variables**: Never commit credentials to Git
2. **HTTPS**: Railway provides HTTPS by default
3. **Rate Limiting**: Consider implementing rate limiting for production use
4. **Authentication**: Add API key authentication for production use

## Cost Optimization

1. **Resource Limits**: Set appropriate CPU/memory limits
2. **Auto-sleep**: Enable auto-sleep for non-production environments
3. **Monitoring**: Monitor usage to optimize costs

## Updates and Maintenance

1. **Automatic Deployments**: Railway deploys automatically on Git push
2. **Dependency Updates**: Regularly update dependencies
3. **Security Updates**: Keep Playwright and other dependencies updated
4. **Monitoring**: Set up alerts for failures
