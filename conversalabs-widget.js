/**
 * ConversaLabs VoiceBot Embeddable SDK
 * Version: 3.1.0 - Production Architecture with Voice AI + Manual Booking
 *
 * Architecture:
 * - Single POST request with agent_id (backend fetches prompt internally)
 * - Dual WebSocket system (Main WS + Transcript WS)
 * - PCM16 audio pipeline @ 16kHz
 * - Agent-based prompt fetching (server-side)
 * - Dual booking modes: Voice AI + Manual Calendar (Cal.com)
 * - Exact UI replica of AIAgentButton + AIAgentModal
 *
 * Usage:
 * <script src="https://yourdomain.com/conversalabs-widget.js"
 *         data-agent-id="agent_abc123"
 *         data-security-key="your-security-key"
 *         data-tts-provider="elevenlabs"
 *         data-cal-link="your-cal-username">
 * </script>
 *
 * Attributes:
 * - data-agent-id: (Required) Your agent ID
 * - data-security-key: (Optional) Security key for authentication
 * - data-tts-provider: (Optional) TTS provider (default: elevenlabs)
 * - data-cal-link: (Optional) Cal.com username for manual booking
 * - data-api-url: (Optional) API base URL
 * - data-ws-url: (Optional) WebSocket URL
 * - data-agent-image: (Optional) Agent avatar image URL
 */

(function() {
  'use strict';

  // Configuration from script tag attributes
  const scriptTag = document.currentScript;
  const config = {
    agentId: scriptTag.getAttribute('data-agent-id'),
    securityKey: scriptTag.getAttribute('data-security-key') || 'default-embed-key',
    ttsProvider: scriptTag.getAttribute('data-tts-provider') || 'elevenlabs',
    apiUrl: scriptTag.getAttribute('data-api-url') || 'http://localhost:7860',
    wsUrl: scriptTag.getAttribute('data-ws-url') || 'ws://localhost:7860',
    agentImage: scriptTag.getAttribute('data-agent-image') || 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&h=200&fit=crop&crop=faces',
    calLink: scriptTag.getAttribute('data-cal-link') || 'demo-not-configured'
  };

  console.log('[ConversaLabs SDK] Configuration:', config);

  // Validation
  if (!config.agentId) {
    console.error('[ConversaLabs SDK] Missing data-agent-id attribute');
    return;
  }

  // VoiceBot state
  let websocket = null;
  let transcriptWs = null;
  let isConnected = false;
  let sessionId = null;
  let audioStream = null;
  let audioContext = null;
  let audioProcessor = null;
  let audioQueue = [];
  let isPlaying = false;
  let isModalOpen = false;
  let isMuted = false;
  let modalView = 'voice'; // 'voice' or 'manual'

  // Transcript state
  let messages = [];
  let messageIds = new Set();
  let userInterimMessage = null;
  let agentInterimMessage = null;
  let agentSpeaking = false;
  let userSpeaking = false;
  let availabilityData = null;
  let bookingConfirmation = null;
  let showSuggestions = false;
  let initialSuggestions = [
    "I'd like to book a demo for tomorrow",
    "Show me available times this week",
    "I'm available next Monday",
    "What times do you have today?"
  ];

  // UI Elements
  let floatingButton = null;
  let modal = null;
  let modalBackdrop = null;
  let transcriptContainer = null;
  let messageInput = null;
  let sendBtn = null;
  let muteBtn = null;
  let closeBtn = null;
  let suggestionsContainer = null;
  let voiceViewContainer = null;
  let manualViewContainer = null;
  let voiceToggleBtn = null;
  let manualToggleBtn = null;

  // SVG Icons
  const Icons = {
    sparkles: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
    mic: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
    micOff: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
    x: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    send: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>'
  };

  // Create AIAgentButton (floating button)
  function createFloatingButton() {
    floatingButton = document.createElement('div');
    floatingButton.id = 'conversalabs-agent-button';
    floatingButton.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      animation: fadeInScale 0.5s ease-out 0.8s both;
    `;

    floatingButton.innerHTML = `
      <button
        class="conversalabs-btn-group"
        aria-label="Book Demo with ConversaLabs AI Agent"
        style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          cursor: pointer;
          transition: transform 0.3s ease;
        "
      >
        <!-- Image container with pulse ring -->
        <div style="position: relative;">
          <!-- Pulse ring effect -->
          <div style="
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: rgb(168, 85, 247);
            animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
            opacity: 0.3;
          "></div>

          <!-- Glow effect -->
          <div style="
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: linear-gradient(to right, rgba(168, 85, 247, 0.4), rgba(236, 72, 153, 0.4));
            filter: blur(20px);
            opacity: 0.6;
            transition: opacity 0.3s;
          "></div>

          <!-- Image -->
          <div style="
            position: relative;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            overflow: hidden;
            border: 4px solid white;
            box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
            transition: box-shadow 0.3s;
          ">
            <img
              src="${config.agentImage}"
              alt="AI Agent"
              style="width: 100%; height: 100%; object-fit: cover;"
            />
          </div>
        </div>

        <!-- Text below -->
        <div style="
          background: white;
          padding: 8px 20px;
          border-radius: 9999px;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
          border: 1px solid rgb(229 231 235);
        ">
          <span style="
            font-size: 14px;
            font-weight: 600;
            color: rgb(17 24 39);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          ">Book Demo</span>
        </div>
      </button>
    `;

    floatingButton.querySelector('button').addEventListener('mouseenter', () => {
      floatingButton.querySelector('button').style.transform = 'scale(1.05)';
    });

    floatingButton.querySelector('button').addEventListener('mouseleave', () => {
      floatingButton.querySelector('button').style.transform = 'scale(1)';
    });

    floatingButton.querySelector('button').addEventListener('click', openModal);

    document.body.appendChild(floatingButton);
  }

  // Create AIAgentModal
  function createModal() {
    // Backdrop
    modalBackdrop = document.createElement('div');
    modalBackdrop.id = 'conversalabs-modal-backdrop';
    modalBackdrop.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 1000000;
      background: transparent;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      display: none;
    `;
    modalBackdrop.addEventListener('click', closeModal);

    // Modal Container
    modal = document.createElement('div');
    modal.id = 'conversalabs-modal';
    modal.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      width: 420px;
      max-height: calc(100vh - 120px);
      height: 700px;
      z-index: 1000001;
      pointer-events: none;
      opacity: 0;
      transform: translateX(400px) translateY(100px);
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Modal Content
    modal.innerHTML = `
      <div style="
        position: relative;
        pointer-events: auto;
        background: white;
        border-radius: 24px;
        box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
        border: 1px solid rgb(229 231 235);
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      " onclick="event.stopPropagation()">

        <!-- Header - Ava AI Status -->
        <div style="
          background: white;
          border-bottom: 1px solid rgb(229 231 235);
          padding: 16px 24px;
        ">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <!-- Left - AI Status -->
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="
                width: 48px;
                height: 48px;
                background: linear-gradient(135deg, rgb(147, 51, 234) 0%, rgb(79, 70, 229) 100%);
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 6px -1px rgba(147, 51, 234, 0.3);
              ">
                ${Icons.sparkles}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <h3 style="
                    font-size: 20px;
                    font-weight: 700;
                    color: rgb(17 24 39);
                    margin: 0;
                  ">Ava</h3>
                  <div style="
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 10px;
                    background: rgb(240 253 244);
                    border: 1px solid rgb(187 247 208);
                    border-radius: 9999px;
                  ">
                    <div style="
                      width: 8px;
                      height: 8px;
                      background: rgb(34 197 94);
                      border-radius: 50%;
                    "></div>
                    <span style="
                      font-size: 12px;
                      color: rgb(21 128 61);
                      font-weight: 600;
                    ">Available</span>
                  </div>
                </div>
                <p style="
                  font-size: 14px;
                  color: rgb(107 114 128);
                  margin: 0;
                ">Your AI Booking Assistant</p>
              </div>
            </div>

            <!-- Right - Controls -->
            <div style="display: flex; align-items: center; gap: 8px;">
              <!-- Mute Button (hidden initially) -->
              <button
                id="conversalabs-mute-btn"
                style="
                  width: 40px;
                  height: 40px;
                  border-radius: 50%;
                  display: none;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.2s;
                  background: rgb(243 244 246);
                  border: none;
                  cursor: pointer;
                "
                aria-label="Mute"
              >
                ${Icons.mic}
              </button>

              <!-- Close Button -->
              <button
                id="conversalabs-close-btn"
                style="
                  width: 40px;
                  height: 40px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.2s;
                  background: transparent;
                  border: none;
                  cursor: pointer;
                  color: rgb(75 85 99);
                "
                aria-label="Close"
              >
                ${Icons.x}
              </button>
            </div>
          </div>
        </div>

        <!-- Content Area - Voice View -->
        <div id="conversalabs-voice-view" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
          <div style="
            flex: 1;
            background: rgb(249 250 251);
            overflow-y: auto;
            padding: 20px;
          " id="conversalabs-transcript">
          </div>

          <!-- Quick Reply Suggestions -->
          <div
            id="conversalabs-suggestions"
            style="
              display: none;
              padding: 12px 16px;
              background: white;
              border-top: 1px solid rgb(229 231 235);
              gap: 8px;
              flex-wrap: wrap;
            "
          ></div>

          <!-- Input Area -->
          <div style="
            padding: 16px;
            background: white;
            border-top: 1px solid rgb(229 231 235);
            display: flex;
            gap: 8px;
            align-items: center;
          ">
            <input
              id="conversalabs-input"
              type="text"
              placeholder="Type a message or use voice..."
              style="
                flex: 1;
                padding: 12px;
                border: 1px solid rgb(229 231 235);
                border-radius: 8px;
                font-size: 14px;
                outline: none;
                font-family: inherit;
              "
            />
            <button
              id="conversalabs-send-btn"
              style="
                background: linear-gradient(135deg, rgb(147, 51, 234) 0%, rgb(79, 70, 229) 100%);
                color: white;
                border: none;
                width: 44px;
                height: 44px;
                border-radius: 8px;
                cursor: pointer;
                transition: opacity 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >
              ${Icons.send}
            </button>
          </div>
        </div>

        <!-- Content Area - Manual View -->
        <div id="conversalabs-manual-view" style="flex: 1; display: none; overflow: hidden; background: white;">
          <div style="padding: 20px; height: 100%; overflow-y: auto;">
            <iframe
              id="conversalabs-cal-iframe"
              width="100%"
              height="100%"
              frameBorder="0"
              style="min-height: 600px; border: none;"
              title="Schedule a meeting"
            ></iframe>
          </div>
        </div>

        <!-- View Toggle Controls -->
        <div style="
          padding: 12px 16px;
          background: white;
          border-top: 1px solid rgb(229 231 235);
        ">
          <div style="
            background: rgb(243 244 246);
            border-radius: 9999px;
            padding: 4px;
            display: flex;
            gap: 4px;
          ">
            <button
              id="conversalabs-voice-toggle"
              style="
                flex: 1;
                padding: 8px 16px;
                border-radius: 9999px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                transition: all 0.2s;
                font-weight: 600;
                font-size: 12px;
                border: none;
                cursor: pointer;
                background: linear-gradient(135deg, rgb(147, 51, 234) 0%, rgb(79, 70, 229) 100%);
                color: white;
                box-shadow: 0 4px 6px -1px rgba(147, 51, 234, 0.3);
              "
            >
              ${Icons.mic}
              <span>Voice AI</span>
            </button>
            <button
              id="conversalabs-manual-toggle"
              style="
                flex: 1;
                padding: 8px 16px;
                border-radius: 9999px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                transition: all 0.2s;
                font-weight: 600;
                font-size: 12px;
                border: none;
                cursor: pointer;
                background: transparent;
                color: rgb(107 114 128);
              "
            >
              ${Icons.calendar}
              <span>Manual</span>
            </button>
          </div>
        </div>

        <!-- Powered By ConversAI Labs -->
        <div style="
          padding: 8px 16px;
          background: white;
          border-top: 1px solid rgb(229 231 235);
          text-align: center;
        ">
          <p style="
            margin: 0;
            font-size: 11px;
            color: rgb(107 114 128);
            font-family: inherit;
          ">
            Powered By <span style="font-weight: 600; color: rgb(147 51 234);">ConversAI Labs</span>
          </p>
        </div>
      </div>
    `;

    // Get references to elements
    transcriptContainer = modal.querySelector('#conversalabs-transcript');
    messageInput = modal.querySelector('#conversalabs-input');
    sendBtn = modal.querySelector('#conversalabs-send-btn');
    muteBtn = modal.querySelector('#conversalabs-mute-btn');
    closeBtn = modal.querySelector('#conversalabs-close-btn');
    suggestionsContainer = modal.querySelector('#conversalabs-suggestions');
    voiceViewContainer = modal.querySelector('#conversalabs-voice-view');
    manualViewContainer = modal.querySelector('#conversalabs-manual-view');
    voiceToggleBtn = modal.querySelector('#conversalabs-voice-toggle');
    manualToggleBtn = modal.querySelector('#conversalabs-manual-toggle');

    // Event listeners
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && messageInput.value.trim()) {
        sendTextMessage(messageInput.value);
        messageInput.value = '';
      }
    });

    sendBtn.addEventListener('mouseover', () => sendBtn.style.opacity = '0.8');
    sendBtn.addEventListener('mouseout', () => sendBtn.style.opacity = '1');
    sendBtn.addEventListener('click', () => {
      if (messageInput.value.trim()) {
        sendTextMessage(messageInput.value);
        messageInput.value = '';
      }
    });

    muteBtn.addEventListener('click', toggleMute);
    closeBtn.addEventListener('click', closeModal);
    voiceToggleBtn.addEventListener('click', switchToVoice);
    manualToggleBtn.addEventListener('click', switchToManual);

    document.body.appendChild(modalBackdrop);
    document.body.appendChild(modal);
  }

  // Switch to Voice AI view
  function switchToVoice() {
    modalView = 'voice';
    voiceViewContainer.style.display = 'flex';
    manualViewContainer.style.display = 'none';

    // Update button styles
    voiceToggleBtn.style.background = 'linear-gradient(135deg, rgb(147, 51, 234) 0%, rgb(79, 70, 229) 100%)';
    voiceToggleBtn.style.color = 'white';
    voiceToggleBtn.style.boxShadow = '0 4px 6px -1px rgba(147, 51, 234, 0.3)';

    manualToggleBtn.style.background = 'transparent';
    manualToggleBtn.style.color = 'rgb(107 114 128)';
    manualToggleBtn.style.boxShadow = 'none';
  }

  // Switch to Manual calendar view
  function switchToManual() {
    modalView = 'manual';
    voiceViewContainer.style.display = 'none';
    manualViewContainer.style.display = 'block';

    // Update button styles
    manualToggleBtn.style.background = 'linear-gradient(135deg, rgb(147, 51, 234) 0%, rgb(79, 70, 229) 100%)';
    manualToggleBtn.style.color = 'white';
    manualToggleBtn.style.boxShadow = '0 4px 6px -1px rgba(147, 51, 234, 0.3)';

    voiceToggleBtn.style.background = 'transparent';
    voiceToggleBtn.style.color = 'rgb(107 114 128)';
    voiceToggleBtn.style.boxShadow = 'none';

    // Load Cal.com iframe if not already loaded
    const calIframe = document.getElementById('conversalabs-cal-iframe');
    if (calIframe && !calIframe.src) {
      const calLink = config.calLink || 'demo-not-configured';
      calIframe.src = `https://app.cal.com/${calLink}?embed=true&theme=light`;
    }
  }

  // Open modal
  async function openModal() {
    isModalOpen = true;
    modalBackdrop.style.display = 'block';
    modal.style.display = 'block';

    // Trigger animation
    setTimeout(() => {
      modalBackdrop.style.opacity = '1';
      modal.style.opacity = '1';
      modal.style.transform = 'translateX(0) translateY(0)';
    }, 10);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Start connection
    if (!isConnected) {
      await connect();
    }
  }

  // Close modal
  function closeModal() {
    modalBackdrop.style.opacity = '0';
    modal.style.opacity = '0';
    modal.style.transform = 'translateX(400px) translateY(100px)';

    setTimeout(() => {
      modalBackdrop.style.display = 'none';
      modal.style.display = 'none';
      document.body.style.overflow = 'unset';
      isModalOpen = false;

      // Reset to voice view
      switchToVoice();

      // Disconnect if connected
      if (isConnected) {
        disconnect();
      }
    }, 400);
  }

  // Toggle mute
  function toggleMute() {
    isMuted = !isMuted;

    if (isMuted) {
      muteBtn.style.background = 'rgb(239 68 68)';
      muteBtn.innerHTML = Icons.micOff;
      muteBtn.querySelector('svg').style.color = 'white';
    } else {
      muteBtn.style.background = 'rgb(243 244 246)';
      muteBtn.innerHTML = Icons.mic;
      muteBtn.querySelector('svg').style.color = 'rgb(55 65 81)';
    }

    // Mute/unmute audio tracks
    if (audioStream) {
      const audioTracks = audioStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }

  // Connect to VoiceBot backend
  async function connect() {
    try {
      console.log('[ConversaLabs SDK] Connecting to VoiceBot backend...');

      // Hardcoded WebSocket URL with agent_id and api_key
      const wsUrl = `wss://pensile-cheryle-crumply.ngrok-free.dev/browser/ws?agent_id=0d595cc3-803d-4ded-a705-45fdc258dd6f&api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjYyMTI2MTksInN1YiI6ImVhNzczMTI2LTAxMmMtNGM2ZC05ZGYwLWQ1ZThkOWZmYmU3OSJ9.3H3oQ84U8_EVWh1YeOM4HOMYpN8I5rOrM2KSJ_C-TAE`;

      // Generate a unique session ID for this connection
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log('[ConversaLabs SDK] Session created:', sessionId);

      // Initialize microphone
      await initializeMicrophone();

      // Connect to main WebSocket
      await connectMainWebSocket(wsUrl);

      // Transcript WebSocket will be connected automatically when we receive call_id from main WebSocket
      console.log('[ConversaLabs SDK] Waiting for call_id to connect transcript WebSocket...');

      isConnected = true;

      // Show mute button
      muteBtn.style.display = 'flex';

      // Change close button to red (call active)
      closeBtn.style.background = 'rgb(239 68 68)';
      closeBtn.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)';
      closeBtn.querySelector('svg').style.color = 'white';

      return true;

    } catch (error) {
      console.error('[ConversaLabs SDK] Connection failed:', error);
      addSystemMessage('Failed to connect. Please try again.');
      return false;
    }
  }

  // Connect to main WebSocket
  function connectMainWebSocket(wsUrl) {
    return new Promise((resolve, reject) => {
      console.log('[ConversaLabs SDK] Connecting to WebSocket:', wsUrl);

      websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log('[ConversaLabs SDK] WebSocket connected');

        // Send handshake
        websocket.send(JSON.stringify({
          type: 'browser_audio',
          action: 'start',
          sampleRate: 16000,
          format: 'pcm16',
          tts_provider: config.ttsProvider
        }));

        // Start conversation
        websocket.send(JSON.stringify({ type: 'start_conversation' }));

        startAudioCapture();
        resolve();
      };

      websocket.onmessage = (event) => {
        handleMainWebSocketMessage(JSON.parse(event.data));
      };

      websocket.onerror = (error) => {
        console.error('[ConversaLabs SDK] WebSocket error:', error);
        addSystemMessage('Connection error. Please try again.');
        reject(error);
      };

      websocket.onclose = () => {
        console.log('[ConversaLabs SDK] WebSocket closed');
        if (isConnected) {
          isConnected = false;
        }
        stopAudioCapture();
      };
    });
  }

  // Handle main WebSocket messages
  function handleMainWebSocketMessage(message) {
    console.log('[ConversaLabs SDK] Received message:', message.type);

    switch (message.type) {
      case 'session_id':
        console.log('[ConversaLabs SDK] Session confirmed:', message.session_id);
        sessionId = message.session_id;
        break;

      case 'call_id':
        console.log('[ConversaLabs SDK] Call ID received:', message.call_id);
        // Connect to transcript WebSocket with the call_id
        const transcriptWsUrl = `wss://pensile-cheryle-crumply.ngrok-free.dev/transcript/${message.call_id}`;
        connectTranscriptWebSocketWithUrl(transcriptWsUrl);
        break;

      case 'audio':
        playAudioResponse(message.data);
        break;

      case 'transcript':
        // Handle interim transcripts for fluency (typing effect)
        if (!message.is_final) {
          const role = message.role || 'agent';
          if (role === 'agent') {
            agentInterimMessage = message.text;
            updateInterimMessage('agent', message.text);
          } else {
            userInterimMessage = message.text;
            updateInterimMessage('user', message.text);
          }
        } else {
          // Clear interim messages (final handled by transcript WS)
          const role = message.role || 'agent';
          if (role === 'agent') {
            agentInterimMessage = null;
            removeInterimMessage('agent');
          } else {
            userInterimMessage = null;
            removeInterimMessage('user');
          }
        }
        break;

      case 'function_result':
        // Handle availability data
        if (message.function_name === 'check_availability') {
          console.log('[ConversaLabs SDK] Availability data:', message.result);
          availabilityData = message.result;
          renderAvailabilityCard(message.result);
        }
        break;

      case 'booking_confirmed':
        console.log('[ConversaLabs SDK] Booking confirmed:', message.booking);
        bookingConfirmation = message.booking;
        availabilityData = null;
        renderBookingConfirmation(message.booking);
        break;

      case 'agent_speaking':
        agentSpeaking = message.is_speaking;
        break;

      case 'user_speaking':
        userSpeaking = message.is_speaking;
        break;

      case 'error':
        console.error('[ConversaLabs SDK] Error:', message.message);
        addSystemMessage('Error: ' + message.message);
        break;

      default:
        console.log('[ConversaLabs SDK] Unknown message type:', message.type);
    }
  }

  // Connect to transcript WebSocket with URL
  function connectTranscriptWebSocketWithUrl(transcriptWsUrl) {
    if (transcriptWs && transcriptWs.readyState === WebSocket.OPEN) {
      console.log('[ConversaLabs SDK] Transcript WebSocket already connected');
      return;
    }

    console.log('[ConversaLabs SDK] Connecting to transcript WebSocket:', transcriptWsUrl);

    transcriptWs = new WebSocket(transcriptWsUrl);

    transcriptWs.onopen = () => {
      console.log('[ConversaLabs SDK] ✅ Transcript WebSocket connected successfully');
    };

    transcriptWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('[ConversaLabs SDK] Transcript message:', data);

      if (data.type === 'transcript' && data.is_final) {
        // Only add final messages from transcript WebSocket
        const messageId = data.id || `${data.speaker}-${Date.now()}`;

        // Deduplicate messages
        if (!messageIds.has(messageId)) {
          console.log('[ConversaLabs SDK] ✅ Adding new transcript message:', messageId);
          messageIds.add(messageId);
          addMessage(data.speaker, data.text, messageId);

          // Show suggestions after first agent message
          if (data.speaker === 'agent' && messages.filter(m => m.role === 'user').length === 0) {
            console.log('[ConversaLabs SDK] First agent message detected, showing suggestions...');
            setTimeout(() => {
              showQuickReplySuggestions(initialSuggestions);
            }, 1000);
          }

          // Hide suggestions when user interacts
          if (data.speaker === 'user') {
            hideQuickReplySuggestions();
          }
        } else {
          console.log('[ConversaLabs SDK] ⏭️ Skipping duplicate message:', messageId);
        }
      }
    };

    transcriptWs.onerror = (error) => {
      console.error('[ConversaLabs SDK] ❌ Transcript WebSocket error:', error);
    };

    transcriptWs.onclose = (event) => {
      console.log('[ConversaLabs SDK] 🔴 Transcript WebSocket closed');
    };
  }

  // Disconnect from VoiceBot
  function disconnect() {
    console.log('[ConversaLabs SDK] Disconnecting...');

    if (websocket) {
      websocket.send(JSON.stringify({ type: 'end_conversation' }));
      websocket.close();
      websocket = null;
    }

    if (transcriptWs) {
      transcriptWs.close();
      transcriptWs = null;
    }

    stopAudioCapture();

    isConnected = false;
    sessionId = null;
    messages = [];
    messageIds.clear();
    userInterimMessage = null;
    agentInterimMessage = null;
    agentSpeaking = false;
    userSpeaking = false;
    availabilityData = null;
    bookingConfirmation = null;
    showSuggestions = false;

    transcriptContainer.innerHTML = '';
    suggestionsContainer.innerHTML = '';
    suggestionsContainer.style.display = 'none';

    // Hide mute button
    if (muteBtn) muteBtn.style.display = 'none';

    // Reset close button
    if (closeBtn) {
      closeBtn.style.background = 'transparent';
      closeBtn.style.boxShadow = 'none';
      closeBtn.querySelector('svg').style.color = 'rgb(75 85 99)';
    }
  }

  // Initialize microphone
  async function initializeMicrophone() {
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      audioContext = new AudioContext({ sampleRate: 16000 });
      console.log('[ConversaLabs SDK] Microphone initialized');

    } catch (error) {
      console.error('[ConversaLabs SDK] Microphone access denied:', error);
      addSystemMessage('Please allow microphone access to use voice features.');
      throw error;
    }
  }

  // Start capturing user audio
  function startAudioCapture() {
    if (!audioStream || !audioContext) return;

    const source = audioContext.createMediaStreamSource(audioStream);
    audioProcessor = audioContext.createScriptProcessor(1024, 1, 1);

    audioProcessor.onaudioprocess = (e) => {
      if (!websocket || websocket.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);

      for (let i = 0; i < inputData.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
      }

      const audioData = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));

      websocket.send(JSON.stringify({
        type: 'audio',
        data: audioData
      }));
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);

    console.log('[ConversaLabs SDK] Audio capture started');
  }

  // Stop audio capture
  function stopAudioCapture() {
    if (audioProcessor) {
      audioProcessor.disconnect();
      audioProcessor = null;
    }

    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    audioQueue = [];
    isPlaying = false;

    console.log('[ConversaLabs SDK] Audio capture stopped');
  }

  // Play audio response from VoiceBot
  function playAudioResponse(base64Audio) {
    try {
      const audioData = atob(base64Audio);
      const pcm16 = new Int16Array(audioData.length / 2);

      for (let i = 0; i < pcm16.length; i++) {
        const byte1 = audioData.charCodeAt(i * 2);
        const byte2 = audioData.charCodeAt(i * 2 + 1);
        pcm16[i] = (byte2 << 8) | byte1;
      }

      audioQueue.push(pcm16);
      if (!isPlaying) {
        playNextAudioChunk();
      }

    } catch (error) {
      console.error('[ConversaLabs SDK] Audio playback failed:', error);
    }
  }

  // Play next audio chunk from queue
  function playNextAudioChunk() {
    if (audioQueue.length === 0 || !audioContext) {
      isPlaying = false;
      return;
    }

    isPlaying = true;
    const pcm16 = audioQueue.shift();

    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768;
    }

    const buffer = audioContext.createBuffer(1, float32.length, 16000);
    buffer.copyToChannel(float32, 0);

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);

    source.onended = () => {
      playNextAudioChunk();
    };

    source.start();
  }

  // Send text message
  function sendTextMessage(text) {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      console.error('[ConversaLabs SDK] Cannot send text: WebSocket not connected');
      return;
    }

    console.log('[ConversaLabs SDK] Sending text message:', text);

    // Hide suggestions
    hideQuickReplySuggestions();

    websocket.send(JSON.stringify({
      type: 'user_text',
      text: text
    }));
  }

  // Add message to transcript (matches TranscriptMessage.tsx)
  function addMessage(speaker, text, id) {
    const messageId = id || `${speaker}-${Date.now()}-${Math.random()}`;
    const isUser = speaker === 'user';

    // Store message
    messages.push({
      id: messageId,
      role: speaker,
      text: text,
      timestamp: new Date()
    });

    // Create message container - matches VoiceBooking TranscriptMessage.tsx
    const messageDiv = document.createElement('div');
    messageDiv.id = `msg-${messageId}`;
    messageDiv.dataset.messageId = messageId;
    messageDiv.dataset.role = speaker;
    messageDiv.style.cssText = `
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      animation: slideIn 0.3s ease-out;
    `;

    // Avatar circle (U or AI)
    const avatar = document.createElement('div');
    avatar.style.cssText = `
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      color: white;
      ${isUser
        ? 'background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); box-shadow: 0 1px 2px rgba(37,99,235,0.3);'
        : 'background: linear-gradient(135deg, #1f2937 0%, #111827 100%); box-shadow: 0 1px 2px rgba(0,0,0,0.3);'
      }
    `;
    avatar.textContent = isUser ? 'U' : 'AI';

    // Message content container
    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `
      flex: 1;
      min-width: 0;
    `;

    // Header with name and timestamp
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 6px;
    `;

    const nameLabel = document.createElement('span');
    nameLabel.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    `;
    nameLabel.textContent = isUser ? 'You' : 'AI Assistant';

    const timestamp = document.createElement('span');
    timestamp.style.cssText = `
      font-size: 12px;
      color: #6b7280;
      font-weight: 500;
    `;
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    timestamp.textContent = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;

    header.appendChild(nameLabel);
    header.appendChild(timestamp);

    // Message bubble - matches VoiceBooking gradient style
    const bubble = document.createElement('div');
    bubble.style.cssText = `
      padding: 10px 16px;
      border-radius: 12px;
      display: inline-block;
      max-width: 100%;
      ${isUser
        ? 'background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid rgba(59, 130, 246, 0.3);'
        : 'background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border: 1px solid rgba(229, 231, 235, 0.5);'
      }
      transition: all 0.2s;
    `;
    bubble.style.wordWrap = 'break-word';

    const textContent = document.createElement('p');
    textContent.style.cssText = `
      font-size: 14px;
      line-height: 1.5;
      color: #111827;
      margin: 0;
      white-space: pre-wrap;
    `;
    textContent.textContent = text;

    bubble.appendChild(textContent);
    contentDiv.appendChild(header);
    contentDiv.appendChild(bubble);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    transcriptContainer.appendChild(messageDiv);

    // Auto-scroll
    setTimeout(() => {
      transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
    }, 50);
  }

  // Update interim message (typing effect)
  function updateInterimMessage(speaker, text) {
    const isUser = speaker === 'user';
    let interimDiv = document.getElementById(`interim-${speaker}`);

    if (!interimDiv) {
      // Create interim message with same structure as regular messages
      interimDiv = document.createElement('div');
      interimDiv.id = `interim-${speaker}`;
      interimDiv.style.cssText = `
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
        opacity: 0.7;
      `;

      // Avatar circle
      const avatar = document.createElement('div');
      avatar.style.cssText = `
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        color: white;
        ${isUser
          ? 'background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); box-shadow: 0 1px 2px rgba(37,99,235,0.3);'
          : 'background: linear-gradient(135deg, #1f2937 0%, #111827 100%); box-shadow: 0 1px 2px rgba(0,0,0,0.3);'
        }
      `;
      avatar.textContent = isUser ? 'U' : 'AI';

      // Content container
      const contentDiv = document.createElement('div');
      contentDiv.style.cssText = `
        flex: 1;
        min-width: 0;
      `;

      // Header with typing indicator
      const header = document.createElement('div');
      header.style.cssText = `
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 6px;
      `;

      const nameLabel = document.createElement('span');
      nameLabel.style.cssText = `
        font-size: 14px;
        font-weight: 600;
        color: #111827;
      `;
      nameLabel.textContent = isUser ? 'You' : 'AI Assistant';

      const typingLabel = document.createElement('span');
      typingLabel.style.cssText = `
        font-size: 12px;
        color: #9ca3af;
        font-style: italic;
      `;
      typingLabel.textContent = 'typing...';

      header.appendChild(nameLabel);
      header.appendChild(typingLabel);

      // Bubble with interim text
      const bubble = document.createElement('div');
      bubble.className = 'interim-bubble';
      bubble.style.cssText = `
        padding: 10px 16px;
        border-radius: 12px;
        display: inline-block;
        max-width: 100%;
        ${isUser
          ? 'background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid rgba(59, 130, 246, 0.3);'
          : 'background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border: 1px solid rgba(229, 231, 235, 0.5);'
        }
      `;

      const textContent = document.createElement('p');
      textContent.className = 'interim-text';
      textContent.style.cssText = `
        font-size: 14px;
        line-height: 1.5;
        color: #6b7280;
        margin: 0;
        white-space: pre-wrap;
        font-style: italic;
      `;
      textContent.textContent = text;

      bubble.appendChild(textContent);
      contentDiv.appendChild(header);
      contentDiv.appendChild(bubble);
      interimDiv.appendChild(avatar);
      interimDiv.appendChild(contentDiv);
      transcriptContainer.appendChild(interimDiv);
    } else {
      // Update existing interim message text
      const textElement = interimDiv.querySelector('.interim-text');
      if (textElement) textElement.textContent = text;
    }

    // Auto-scroll
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
  }

  // Remove interim message
  function removeInterimMessage(speaker) {
    const interimDiv = document.getElementById(`interim-${speaker}`);
    if (interimDiv) {
      interimDiv.remove();
    }
  }

  // Add system message
  function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      margin-bottom: 16px;
      text-align: center;
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      display: inline-block;
      padding: 8px 16px;
      border-radius: 12px;
      background: #FEF3C7;
      color: #92400E;
      font-size: 12px;
      font-style: italic;
    `;
    bubble.textContent = text;

    messageDiv.appendChild(bubble);
    transcriptContainer.appendChild(messageDiv);
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
  }

  // Render availability card
  function renderAvailabilityCard(data) {
    const cardDiv = document.createElement('div');
    cardDiv.style.cssText = `
      margin-bottom: 16px;
      display: flex;
      justify-content: flex-start;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      max-width: 85%;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;

    card.innerHTML = `
      <div style="font-weight: 600; color: #1f2937; margin-bottom: 8px; font-size: 15px;">
        📅 Available Times for ${data.date}
      </div>
      <div style="color: #6b7280; font-size: 13px; margin-bottom: 12px;">
        ${data.available_times ? data.available_times.length : 0} slots available
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${data.available_times ? data.available_times.map(time => `
          <div style="padding: 6px 12px; background: #f3f4f6; border-radius: 6px; font-size: 13px; color: #374151;">
            ${formatTime(time)}
          </div>
        `).join('') : '<div style="color: #9ca3af; font-size: 13px;">No times available</div>'}
      </div>
    `;

    cardDiv.appendChild(card);
    transcriptContainer.appendChild(cardDiv);
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
  }

  // Render booking confirmation card
  function renderBookingConfirmation(booking) {
    const cardDiv = document.createElement('div');
    cardDiv.style.cssText = `
      margin-bottom: 16px;
      display: flex;
      justify-content: flex-start;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      max-width: 85%;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      color: white;
    `;

    card.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 12px; font-size: 16px;">
        ✅ Booking Confirmed!
      </div>
      <div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 12px; margin-bottom: 8px;">
        <div style="font-size: 13px; opacity: 0.9; margin-bottom: 4px;">Date & Time</div>
        <div style="font-weight: 600; font-size: 15px;">${booking.date} at ${formatTime(booking.time)}</div>
      </div>
      <div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 12px;">
        <div style="font-size: 13px; opacity: 0.9; margin-bottom: 4px;">Name</div>
        <div style="font-weight: 600; font-size: 14px;">${booking.name}</div>
        ${booking.phone ? `
          <div style="font-size: 13px; opacity: 0.9; margin-top: 8px; margin-bottom: 4px;">Phone</div>
          <div style="font-size: 14px;">${booking.phone}</div>
        ` : ''}
        ${booking.email ? `
          <div style="font-size: 13px; opacity: 0.9; margin-top: 8px; margin-bottom: 4px;">Email</div>
          <div style="font-size: 14px;">${booking.email}</div>
        ` : ''}
      </div>
      <div style="margin-top: 12px; font-size: 12px; opacity: 0.9; text-align: center;">
        📧 Confirmation sent to your email
      </div>
    `;

    cardDiv.appendChild(card);
    transcriptContainer.appendChild(cardDiv);
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
  }

  // Show quick reply suggestions
  function showQuickReplySuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) return;

    showSuggestions = true;
    suggestionsContainer.innerHTML = '';
    suggestionsContainer.style.display = 'flex';

    suggestions.forEach(suggestion => {
      const btn = document.createElement('button');
      btn.textContent = suggestion;
      btn.style.cssText = `
        padding: 8px 16px;
        background: white;
        border: 1px solid rgb(147, 51, 234);
        color: rgb(147, 51, 234);
        border-radius: 20px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        font-family: inherit;
      `;

      btn.onmouseover = () => {
        btn.style.background = 'linear-gradient(135deg, rgb(147, 51, 234) 0%, rgb(79, 70, 229) 100%)';
        btn.style.color = 'white';
      };

      btn.onmouseout = () => {
        btn.style.background = 'white';
        btn.style.color = 'rgb(147, 51, 234)';
      };

      btn.onclick = () => {
        sendTextMessage(suggestion);
        hideQuickReplySuggestions();
      };

      suggestionsContainer.appendChild(btn);
    });
  }

  // Hide quick reply suggestions
  function hideQuickReplySuggestions() {
    showSuggestions = false;
    suggestionsContainer.style.display = 'none';
    suggestionsContainer.innerHTML = '';
  }

  // Format time from 24h to 12h
  function formatTime(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  }

  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInScale {
      from {
        opacity: 0;
        transform: scale(0);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes ping {
      75%, 100% {
        transform: scale(2);
        opacity: 0;
      }
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    #conversalabs-transcript::-webkit-scrollbar {
      width: 6px;
    }

    #conversalabs-transcript::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 10px;
    }

    #conversalabs-transcript::-webkit-scrollbar-thumb {
      background: #cbd5e0;
      border-radius: 10px;
    }

    #conversalabs-transcript::-webkit-scrollbar-thumb:hover {
      background: #a0aec0;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      #conversalabs-modal {
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        max-height: 100vh !important;
        height: 100vh !important;
        border-radius: 0 !important;
      }

      #conversalabs-modal > div > div {
        border-radius: 0 !important;
      }
    }
  `;
  document.head.appendChild(style);

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createFloatingButton();
      createModal();
    });
  } else {
    createFloatingButton();
    createModal();
  }

  console.log('[ConversaLabs SDK] Version 3.1.0 - Voice AI + Manual Booking');
  console.log('[ConversaLabs SDK] Agent ID:', config.agentId);
  console.log('[ConversaLabs SDK] Security Key:', config.securityKey);
  console.log('[ConversaLabs SDK] TTS Provider:', config.ttsProvider);
  console.log('[ConversaLabs SDK] Cal.com Link:', config.calLink);

})();
