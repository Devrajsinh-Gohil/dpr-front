"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Send, 
  Trash2, 
  Settings, 
  Plus,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronRight,
  User,
  Bot,
  X,
  Menu
} from 'lucide-react';

const AudioTranscriptionApp = () => {
  // State management
  const [config, setConfig] = useState({
    password: '',
    name: '',
    location: '',
    url: '',
    groqApiKey: '',
    availableSheets: [],
    credentialsLoaded: false
  });
  
  const [selectedSheet, setSelectedSheet] = useState('');
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isUpdatingSheet, setIsUpdatingSheet] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [expandedSessions, setExpandedSessions] = useState(new Set());

  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  // Create new session
  const createNewSession = () => {
    const newSession = {
      id: Date.now(),
      title: 'New Transcription',
      timestamp: new Date(),
      transcriptions: [],
      isCompleted: false
    };
    
    setSessionHistory(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setCurrentTranscription('');
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // Update session title based on first transcription
  const updateSessionTitle = (sessionId, firstTranscription) => {
    const title = firstTranscription.length > 50 
      ? firstTranscription.substring(0, 50) + '...'
      : firstTranscription;
    
    setSessionHistory(prev => 
      prev.map(session => 
        session.id === sessionId 
          ? { ...session, title }
          : session
      )
    );
  };

  // Add transcription to current session
  const addToCurrentSession = (transcription) => {
    if (!currentSessionId) {
      createNewSession();
      return;
    }

    setSessionHistory(prev => 
      prev.map(session => {
        if (session.id === currentSessionId) {
          const updatedTranscriptions = [...session.transcriptions, {
            id: Date.now(),
            text: transcription,
            timestamp: new Date()
          }];
          
          const updatedTitle = session.transcriptions.length === 0 
            ? (transcription.length > 50 ? transcription.substring(0, 50) + '...' : transcription)
            : session.title;
            
          return {
            ...session,
            title: updatedTitle,
            transcriptions: updatedTranscriptions
          };
        }
        return session;
      })
    );
  };

  // Complete current session
  const completeCurrentSession = () => {
    if (!currentSessionId) return;
    
    setSessionHistory(prev => 
      prev.map(session => 
        session.id === currentSessionId 
          ? { ...session, isCompleted: true }
          : session
      )
    );
    setCurrentSessionId(null);
  };

  // Load session
  const loadSession = (sessionId) => {
    const session = sessionHistory.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      const combinedText = session.transcriptions.map(t => t.text).join('\n\n');
      setCurrentTranscription(combinedText);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    }
  };

  // Show message helper
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // Save configuration and get credentials
  const saveConfiguration = async () => {
    console.log('[Config] Starting save configuration...');
    
    // Validate required fields
    if (!config.password || !config.name || !config.location) {
      const missingFields = [];
      if (!config.password) missingFields.push('password');
      if (!config.name) missingFields.push('name');
      if (!config.location) missingFields.push('location');
      
      const errorMsg = `Please fill in all required fields. Missing: ${missingFields.join(', ')}`;
      console.error('[Config] Validation failed:', errorMsg);
      showMessage('error', errorMsg);
      return;
    }

    try {
      console.log('[Config] Attempting to fetch credentials...');
      const url = `https://${config.password}.ngrok-free.app`;
      console.log('[Config] Using URL:', url);
      
      const startTime = performance.now();
      const requestUrl = `${url}/get_credentials`;
      console.log(`[Config] Sending GET request to: ${requestUrl}`);
      
      // Make the GET request with CORS and ngrok headers
      const response = await fetch(requestUrl, {
        method: 'GET',
        mode: 'cors', // Enable CORS mode
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Access-Control-Allow-Origin': '*', // Request CORS access
        },
      });
      
      // Check if the response is ok (status in the range 200-299)
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Config] Server responded with error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      const endTime = performance.now();
      
      console.log(`[Config] Request completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log('[Config] Response status:', response.status, response.statusText);
      
      // Log response headers
      console.log('[Config] Response headers:');
      const headers = {};
      response.headers.forEach((value, key) => {
        console.log(`  ${key}: ${value}`);
        headers[key] = value;
      });
      
      // Get response as text once
      const responseText = await response.text();
      console.log('[Config] Raw response body:', responseText);
      
      // Log response details
      console.log('[Config] Response details:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        type: response.type,
        url: response.url,
        headers,
        redirected: response.redirected,
        bodyUsed: response.bodyUsed,
        responseLength: responseText.length,
        responsePreview: responseText.length > 1000 
          ? responseText.substring(0, 1000) + '...' 
          : responseText
      });
      
      let creds;
      
      try {
        // Try to parse as JSON
        console.log('[Config] Attempting to parse response as JSON...');
        creds = JSON.parse(responseText);
        console.log('[Config] Successfully parsed JSON response');
      } catch (jsonError) {
        // If it's not valid JSON, log detailed error info
        console.error('[Config] Failed to parse response as JSON:', {
          error: jsonError.message,
          responseContentType: response.headers.get('content-type'),
          responseStatus: response.status,
          responseStatusText: response.statusText,
          responsePreview: responseText.substring(0, 300) // First 300 chars of response
        });
        
        // Check if it's an HTML response
        const isHtml = responseText.trim().startsWith('<!DOCTYPE') || 
                      responseText.trim().startsWith('<html>') ||
                      responseText.includes('html>') ||
                      (response.headers.get('content-type')?.includes('text/html'));
        
        if (isHtml) {
          // Extract title or error message from HTML if possible
          const titleMatch = responseText.match(/<title>([^<]+)<\/title>/i);
          const errorTitle = titleMatch ? titleMatch[1] : 'Server Error';
          
          // Try to extract more details from common error page patterns
          let errorDetails = '';
          const bodyMatch = responseText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          if (bodyMatch) {
            const bodyContent = bodyMatch[1];
            // Try to find error messages in common patterns
            const errorMatch = bodyContent.match(/<h1[^>]*>([^<]+)<\/h1>/i) || 
                              bodyContent.match(/<p[^>]*>([^<]+)<\/p>/i);
            if (errorMatch) {
              errorDetails = ` - ${errorMatch[1].trim()}`;
            }
          }
          
          throw new Error(`Server returned an HTML error page (${response.status} ${response.statusText}): ${errorTitle}${errorDetails}`);
        } else {
          // If it's not HTML but still not JSON, show the first 200 chars of the response
          throw new Error(`Unexpected response format: ${responseText.substring(0, 200)}...`);
        }
      }
      
      // If we get here, we have valid JSON
      console.log('[Config] Received credentials:', {
        hasApiKey: !!creds.GROQ_API_KEY,
        sheetsCount: creds.AVAILABLE_SHEETS?.length || 0,
        sheetsSample: creds.AVAILABLE_SHEETS?.slice(0, 3) // Log first 3 sheets for reference
      });
      
      // Validate the response structure
      if (!creds.GROQ_API_KEY || !Array.isArray(creds.AVAILABLE_SHEETS)) {
        console.error('[Config] Invalid response structure:', creds);
        throw new Error('Invalid response format from server. Missing required fields.');
      }
      
      const updatedConfig = {
        url,
        groqApiKey: creds.GROQ_API_KEY || '',
        availableSheets: creds.AVAILABLE_SHEETS || [],
        credentialsLoaded: true
      };
      
      console.log('[Config] Updating configuration...');
      setConfig(prev => ({
        ...prev,
        ...updatedConfig
      }));
      
      const validSheets = (creds.AVAILABLE_SHEETS || []).filter(
        sheet => sheet && typeof sheet === 'string' && sheet.toUpperCase() !== 'LOGS'
      );
      
      console.log('[Config] Valid sheets after filtering:', validSheets);
      
      if (validSheets.length > 0) {
        const selected = validSheets[0];
        console.log('[Config] Setting selected sheet:', selected);
        setSelectedSheet(selected);
      } else {
        console.warn('[Config] No valid sheets available after filtering');
      }
      
      console.log('[Config] Configuration saved successfully');
      showMessage('success', 'Credentials loaded successfully!');
      setShowSettings(false);
    } catch (error) {
      console.error('[Config] Error in saveConfiguration:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      
      // Show user-friendly error message
      let userMessage = error.message;
      if (error.message.includes('Failed to fetch')) {
        userMessage = 'Failed to connect to the server. Please check your internet connection and try again.';
      } else if (error.message.includes('Unexpected token') || error.message.includes('JSON')) {
        userMessage = 'Received an invalid response from the server. The server may be experiencing issues.';
      } else if (error.message.includes('404')) {
        userMessage = 'The requested resource was not found. Please check the server URL and try again.';
      } else if (error.message.includes('500')) {
        userMessage = 'The server encountered an error. Please try again later.';
      }
      
      showMessage('error', userMessage);
    }
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      showMessage('error', 'Error accessing microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  // Transcribe audio
  const transcribeAudio = async () => {
    if (!audioBlob || !config.groqApiKey) return;

    setIsTranscribing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'json');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.groqApiKey}` },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        const transcription = result.text?.trim();
        
        if (transcription) {
          const newText = currentTranscription 
            ? `${currentTranscription}\n\n${transcription}`
            : transcription;
          setCurrentTranscription(newText);
          addToCurrentSession(transcription);
          setAudioBlob(null);
        }
      }
    } catch (error) {
      showMessage('error', 'Transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Submit to sheet
  const submitToSheet = async () => {
    if (!selectedSheet || !config.name.trim() || !currentTranscription.trim()) {
      showMessage('error', 'Missing required information');
      return;
    }

    setIsUpdatingSheet(true);

    try {
      const transcriptionList = currentTranscription
      
      const payload = {
        transcription: transcriptionList,
        sheet_name: selectedSheet,
        name: config.name.trim(),
        location: config.location.trim()
      };

      const response = await fetch(`${config.url}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showMessage('success', 'Sheet updated successfully!');
        completeCurrentSession();
        setCurrentTranscription('');
      } else {
        throw new Error('Server error');
      }
    } catch (error) {
      showMessage('error', 'Failed to update sheet');
    } finally {
      setIsUpdatingSheet(false);
    }
  };

  // Initialize with first session on mount
  useEffect(() => {
    if (sessionHistory.length === 0) {
      createNewSession();
    }
  }, []);

  // Handle window resize for sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    handleResize(); // Set initial state
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (window.innerWidth < 768 && sidebarOpen && !event.target.closest('.sidebar')) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [sidebarOpen]);

  const validSheets = config.availableSheets.filter(
    sheet => sheet.toUpperCase() !== 'LOGS'
  );

  const currentSession = sessionHistory.find(s => s.id === currentSessionId);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        sidebar
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 
        fixed md:relative 
        z-50 md:z-auto
        w-64 md:w-64 
        h-full
        bg-white text-gray-800 
        border-r border-gray-200
        transition-transform duration-300 
        flex flex-col
        shadow-sm
      `}>
        {/* Sidebar Header */}
        <div className="p-3 md:p-4 border-b border-gray-200">
          <button
            onClick={createNewSession}
            className="w-full flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-md transition-colors text-sm text-gray-800 font-medium"
          >
            <Plus size={16} className="text-gray-600" />
            New chat
          </button>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <h3 className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Recent chats
            </h3>
            
            {sessionHistory.map((session) => (
              <div key={session.id} className="mb-1">
                <button
                  onClick={() => loadSession(session.id)}
                  className={`w-full text-left px-2 md:px-3 py-2.5 rounded-md text-sm transition-colors hover:bg-gray-100 ${
                    currentSessionId === session.id ? 'bg-gray-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-xs md:text-sm">{session.title}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Clock size={10} />
                        <span className="text-xs">{session.timestamp.toLocaleDateString()}</span>
                        {session.isCompleted && (
                          <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                            Done
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* User Profile */}
        <div className="p-3 md:p-4 border-t border-gray-200">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {config.name || 'User'}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {config.location || 'No location'}
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1 hover:bg-gray-100 rounded-md flex-shrink-0 text-gray-500"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-3 md:px-4 flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg md:hidden"
            >
              <Menu size={20} />
            </button>
            <h1 className="font-medium text-gray-800 truncate text-sm md:text-base">
              {currentSession?.title || 'AI Audio Transcription'}
            </h1>
          </div>

          {config.credentialsLoaded && validSheets.length > 0 && (
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                className="px-2 md:px-3 py-1.5 border border-gray-300 rounded-md text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white max-w-32 md:max-w-none text-black"
              >
                {validSheets.map((sheet) => (
                  <option key={sheet} value={sheet}>{sheet}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {!config.credentialsLoaded ? (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200">
                  <Settings size={24} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Auto DPR
                </h3>
                <p className="text-gray-500 mb-6 text-sm md:text-base">
                  Configure your settings to start updating DPR
                </p>
                <button
                  onClick={() => setShowSettings(true)}
                  className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2.5 rounded-md transition-colors text-sm font-medium"
                >
                  Get Started
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto p-3 md:p-6 space-y-4 md:space-y-6">
              {/* Status Messages */}
              {message.text && (
                <div className={`p-3 md:p-4 rounded-md border text-sm ${
                  message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                  message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                  'bg-yellow-50 border-yellow-200 text-yellow-800'
                }`}>
                  {message.text}
                </div>
              )}

              {/* Transcription Area */}
              <div className="relative">
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm min-h-[160px] relative">
                  <textarea
                    value={currentTranscription}
                    onChange={(e) => setCurrentTranscription(e.target.value)}
                    className="w-full h-48 md:h-64 p-4 md:p-6 border-none bg-transparent rounded-lg resize-none focus:outline-none text-base leading-relaxed text-black placeholder-gray-500"
                    placeholder="Your transcription will appear here..."
                  />
                  
                  {/* Bottom Controls */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Clear button */}
                      <button
                        onClick={() => setCurrentTranscription('')}
                        className="w-8 h-8 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                        title="Clear transcription"
                      >
                        <X size={16} className="text-gray-600" />
                      </button>
                      
                      {/* Tools button */}
                      <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-300 hover:bg-gray-50 transition-colors text-sm text-gray-600">
                        <Settings size={14} />
                        <span>Tools</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Mic button */}
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                          isRecording 
                            ? 'bg-red-500 hover:bg-red-600 text-white' 
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                        }`}
                        title={isRecording ? "Stop recording" : "Start recording"}
                      >
                        {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                      </button>

                      {/* Submit button */}
                      <button
                        onClick={submitToSheet}
                        disabled={isUpdatingSheet || !currentTranscription.trim()}
                        className="w-8 h-8 rounded-md bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 text-white flex items-center justify-center transition-colors"
                        title="Submit to sheet"
                      >
                        {isUpdatingSheet ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        ) : (
                          <Send size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Audio transcription controls when audio is ready */}
                {audioBlob && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <audio
                          src={URL.createObjectURL(audioBlob)}
                          controls
                          className="h-8"
                        />
                      </div>
                      <button
                        onClick={transcribeAudio}
                        disabled={isTranscribing}
                        className="bg-gray-800 hover:bg-gray-900 active:bg-gray-800 disabled:bg-gray-300 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2 text-sm touch-manipulation"
                      >
                        {isTranscribing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            Transcribing...
                          </>
                        ) : (
                          'Transcribe'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-4 md:p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 touch-manipulation"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Server Password
                </label>
                <input
                  type="password"
                  value={config.password}
                  onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={config.location}
                  onChange={(e) => setConfig(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-black"
                />
              </div>

              <button
                onClick={saveConfiguration}
                className="w-full bg-gray-800 hover:bg-gray-900 active:bg-gray-800 text-white py-2.5 px-4 rounded-md transition-colors touch-manipulation text-sm font-medium"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioTranscriptionApp;
