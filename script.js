const API_URL = 'https://api.groq.com/openai/v1';
const API_KEY = 'Enter your API key here';

let chatForm, userInput, chatMessages, sendButton;

const defaultOptions = {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  },
  cache: 'no-cache'
};

const messageTemplate = document.createElement('div');
messageTemplate.className = 'message';

const avatarTemplate = document.createElement('div');
avatarTemplate.className = 'message-avatar';

const contentTemplate = document.createElement('div');
contentTemplate.className = 'message-content';

const markdownPatterns = {
  headings: {
    h3: /^### (.*$)/gm,
    h2: /^## (.*$)/gm,
    h1: /^# (.*$)/gm
  },
  bullets: /^[*-] (.*$)/gm,
  lists: /(<li>.*<\/li>)\n\n/gs,
  bold: /\*\*(.*?)\*\*/g,
  italic: /\*(.*?)\*/g,
  codeBlocks: /```([^`]+)```/g,
  inlineCode: /`([^`]+)`/g,
  lineBreaks: /\n\n/g
};

async function fetchFromAPI(endpoint = '', options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  const requestOptions = { ...defaultOptions, ...options };
  
  try {
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      const errorDetails = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`API error (${response.status}): ${errorDetails.message || response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

async function createChatCompletion(messages, options = {}) {
  return fetchFromAPI('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: options.model || 'llama3-8b-8192',
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 1000
    })
  });
}

function formatAIResponse(text) {
  return text
    .replace(markdownPatterns.headings.h3, '<h3>$1</h3>')
    .replace(markdownPatterns.headings.h2, '<h2>$1</h2>')
    .replace(markdownPatterns.headings.h1, '<h1>$1</h1>')
    .replace(markdownPatterns.bullets, '<li>$1</li>')
    .replace(markdownPatterns.lists, '<ul>$1</ul>\n\n')
    .replace(markdownPatterns.bold, '<strong>$1</strong>')
    .replace(markdownPatterns.italic, '<em>$1</em>')
    .replace(markdownPatterns.codeBlocks, '<pre><code>$1</code></pre>')
    .replace(markdownPatterns.inlineCode, '<code>$1</code>')
    .replace(markdownPatterns.lineBreaks, '<br><br>');
}

function createMessageElement(content, isUser = false) {
  const messageDiv = messageTemplate.cloneNode(true);
  messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
  
  const avatarDiv = avatarTemplate.cloneNode(true);
  
  if (isUser) {
    avatarDiv.innerHTML = '<img src="https://img.icons8.com/?size=100&id=kDoeg22e5jUY&format=png&color=000000" alt="User avatar">';
  } else {
    avatarDiv.innerHTML = '<div class="ai-avatar">AI</div>';
  }
  
  const contentDiv = contentTemplate.cloneNode(true);
  contentDiv[isUser ? 'textContent' : 'innerHTML'] = isUser ? content : formatAIResponse(content);
  
  messageDiv.appendChild(avatarDiv);
  messageDiv.appendChild(contentDiv);
  
  return messageDiv;
}

function clearWelcomeMessage() {
  const welcomeContainer = document.querySelector('.welcome-container');
  welcomeContainer?.remove();
}

function setLoadingState(isLoading) {
  sendButton.disabled = isLoading;
  userInput.disabled = isLoading;
  sendButton.innerHTML = isLoading ? 
    '<i class="fas fa-spinner fa-spin"></i>' : 
    '<i class="fas fa-paper-plane"></i>';
}

const debouncedResize = debounce(function(element) {
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
}, 10);

function initChat() {
  chatForm = document.getElementById('chat-form');
  userInput = document.getElementById('user-input');
  chatMessages = document.getElementById('chat-messages');
  sendButton = document.querySelector('.send-btn');
  
  if (!chatForm || !userInput || !chatMessages || !sendButton) {
    console.error('Required DOM elements not found');
    return;
  }
  
  async function handleSubmit() {
    const message = userInput.value.trim();
    if (!message) return;
    
    chatMessages.appendChild(createMessageElement(message, true));
    
    userInput.value = '';
    debouncedResize(userInput);
    
    setLoadingState(true);
    clearWelcomeMessage();
    
    const tempLoadingMessage = createMessageElement('Thinking...', false);
    chatMessages.appendChild(tempLoadingMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try {
      const response = await createChatCompletion([
        { 
          role: 'system', 
          content: 'You are a helpful, friendly AI assistant. Provide structured, well-formatted responses using markdown. Use headings (###) for sections, bullet points for lists, and **bold** for emphasis. For technical content, use code blocks. Structure your answers in clear sections when appropriate.' 
        },
        { role: 'user', content: message }
      ]);
      
      chatMessages.removeChild(tempLoadingMessage);
      
      if (response.choices?.[0]) {
        chatMessages.appendChild(createMessageElement(response.choices[0].message.content, false));
      } else {
        chatMessages.appendChild(createMessageElement('Sorry, I couldn\'t generate a response.', false));
      }
    } catch (error) {
      tempLoadingMessage.remove();
      chatMessages.appendChild(createMessageElement(`Sorry, there was an error connecting to the AI service: ${error.message}`, false));
    } finally {
      setLoadingState(false);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }
  
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit();
  });
  
  userInput.addEventListener('input', () => debouncedResize(userInput));
  
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  });
  
  const newChatBtn = document.querySelector('.new-chat-btn');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      chatMessages.innerHTML = `
        <div class="welcome-container">
          <h1 class="welcome-message">Hello, <span class="username">Nice to meet you!</span></h1>
        </div>
      `;
      userInput.value = '';
      debouncedResize(userInput);
    });
  }
  
  debouncedResize(userInput);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

document.addEventListener('DOMContentLoaded', initChat);
