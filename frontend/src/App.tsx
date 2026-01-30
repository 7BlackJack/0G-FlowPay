import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import axios from 'axios'
import { generateWallet, signPayment } from './utils/crypto'
import { Terminal, CreditCard, Send, Database, ShieldCheck, Activity, AlertTriangle, Coins, ExternalLink, PlayCircle } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import PaymentChannelArtifact from './contracts/PaymentChannel.json';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Config
const PROVIDER_URL = "http://127.0.0.1:5000";
// const CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"; // Mock

interface Log {
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

function App() {
  // State
  const [wallet, setWallet] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  
  // Payment State
  const [contractAddress, setContractAddress] = useState<string>("");
  const [balance, setBalance] = useState<bigint>(0n);
  const [nonce, setNonce] = useState(0);
  const [lastBlobHash, setLastBlobHash] = useState<string>("None");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  
  // Payment Animation State
  const [lastPaymentAmount, setLastPaymentAmount] = useState<string>("0");
  const [showPaymentAnim, setShowPaymentAnim] = useState(false);

  // Error/Modal State
  const [isInsufficientFunds, setIsInsufficientFunds] = useState(false);

  // Layout State (Resizable Logs)
  const [logPanelWidth, setLogPanelWidth] = useState(320);
  const [isResizingLogs, setIsResizingLogs] = useState(false);
  const [storedContract, setStoredContract] = useState<string | null>("0xFbFb1596f935D868AC2A5C273aCC59479Bc381a4");
  const [providerAddress, setProviderAddress] = useState<string>("");

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch provider address
    axios.get(`${PROVIDER_URL}/config`)
        .then(res => {
            if (res.data.receiver_address) {
                setProviderAddress(res.data.receiver_address);
                console.log("Provider Address:", res.data.receiver_address);
            }
        })
        .catch(err => console.error("Failed to fetch provider config", err));
  }, []);

  // Handle Resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLogs) {
        // Calculate new width: Window Width - Mouse X
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 200 && newWidth < 800) {
          setLogPanelWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingLogs(false);
    };

    if (isResizingLogs) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLogs]);

  const connectWallet = async () => {
    // Try to connect to MetaMask first
    if (window.ethereum) {
      try {
        // Request account access first
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const addr = await signer.getAddress();
        
        // Enforce 0G Galileo Testnet (Chain ID 16602)
        const network = await provider.getNetwork();
        if (network.chainId !== 16602n) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x40da' }], // 16602 in hex
            });
          } catch (switchError: any) {
            if (switchError.code === 4902 || switchError.code === -32602 || switchError.message?.includes("URL")) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: '0x40da',
                                chainName: '0G-Testnet-Galileo',
                                rpcUrls: ['https://evmrpc-testnet.0g.ai'],
                                nativeCurrency: {
                                        name: '0G',
                                        symbol: '0G',
                                        decimals: 18,
                                    },
                                blockExplorerUrls: ['https://chainscan-galileo.0g.ai'],
                            },
                        ],
                    });
                } catch (addError: any) {
                     if (addError.message?.includes("URL")) {
                         addLog('warning', 'Network conflict: This RPC URL is already added to another network in your wallet. Please switch to "0G-Testnet-Galileo" manually.');
                         return;
                     }
                     throw addError;
                }
            } else {
                throw switchError;
            }
          }
          // Re-get signer after switch
          const newProvider = new ethers.BrowserProvider(window.ethereum);
          const newSigner = await newProvider.getSigner();
          setWallet(newSigner);
          setAddress(await newSigner.getAddress());
          addLog('info', `Connected to MetaMask (0G Galileo): ${addr}`);
          
          // Check balance immediately
          const balance = await newProvider.getBalance(addr);
          if (balance === 0n) {
              // setIsInsufficientFunds(true); // Allow 0 balance now
              addLog('warning', 'Wallet balance is 0. You can still create a channel (Backend pays gas).');
          }

          // Check for stored contract
          const saved = localStorage.getItem(`flowpay_contract_${addr}`) || "0xFbFb1596f935D868AC2A5C273aCC59479Bc381a4";
          if (saved) {
              setStoredContract(saved);
              addLog('info', `Found existing channel contract: ${saved}`);
          }

          return;
        }

        setWallet(signer);
        setAddress(addr);
        addLog('info', `Connected to MetaMask: ${addr}`);
        
        // Check balance
        const balance = await provider.getBalance(addr);
        if (balance === 0n) {
             // setIsInsufficientFunds(true); // Allow 0 balance now
             addLog('warning', 'Wallet balance is 0. You can still create a channel (Backend pays gas).');
        }

        // Check for stored contract
        const saved = localStorage.getItem(`flowpay_contract_${addr}`) || "0xFbFb1596f935D868AC2A5C273aCC59479Bc381a4";
        if (saved) {
            setStoredContract(saved);
            addLog('info', `Found existing channel contract: ${saved}`);
        }

        return;
      } catch (e: any) {
        if (e.code === -32002) {
             addLog('warning', 'MetaMask request pending. Please check your extension.');
             return;
        }
        addLog('warning', `MetaMask connection failed: ${e.message}. Falling back to Agent Wallet.`);
      }
    } else {
        addLog('warning', 'MetaMask not found. Creating autonomous Agent Wallet...');
    }

    // Fallback: Generate Agent Wallet
    const w = generateWallet();
    setWallet(w);
    setAddress(w.address);
    addLog('info', `Agent Wallet generated: ${w.address}`);
    // setIsInsufficientFunds(true); // Agent wallet has 0 funds
    addLog('warning', 'Agent Wallet has 0 funds. Backend will pay for deployment.');
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (type: Log['type'], message: string) => {
    setLogs(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      type,
      message
    }]);
  };

  const initSession = async (cAddress: string, clientAddress: string) => {
      const sid = crypto.randomUUID();
      setSessionId(sid);
      addLog('info', `Initializing session ${sid}...`);
      
      try {
        await axios.post(`${PROVIDER_URL}/init`, {
            session_id: sid,
            contract_address: cAddress,
            client_address: clientAddress
        });
        
        setIsConnected(true);
        addLog('success', 'Channel opened & Session initialized.');
      } catch (e: any) {
        addLog('error', `Session init failed: ${e.message}`);
      }
  };

  const startDemoMode = async () => {
    if (!wallet) return;
    setIsInsufficientFunds(false);
    
    const simulatedAddress = ethers.Wallet.createRandom().address;
    addLog('warning', `Starting Demo Mode (Simulation). Using virtual contract: ${simulatedAddress}`);
    setContractAddress(simulatedAddress);
    
    await initSession(simulatedAddress, address);
  };

  const resumeSession = async () => {
      if (!storedContract || !address) return;
      setContractAddress(storedContract);
      await initSession(storedContract, address);
  };

  const connect = async () => {
    if (!wallet) return;
    
    let useBackendDeployment = false;

    // Check balance again
    if (wallet.provider) {
        const bal = await wallet.provider.getBalance(address);
        if (bal === 0n) {
             useBackendDeployment = true;
             addLog('warning', 'Balance is 0. Switching to Sponsored Deployment (Backend pays gas).');
        } else {
             addLog('info', `Balance: ${ethers.formatEther(bal)} 0G`);
        }
    }

    try {
      setIsDeploying(true);
      
      let deployedAddress = "";

      if (useBackendDeployment) {
          addLog('info', 'Requesting Backend to deploy PaymentChannel...');
          const deployResp = await axios.post(`${PROVIDER_URL}/deploy`, {
              client_address: address
          });
          
          if (deployResp.data.error) {
              throw new Error(deployResp.data.error);
          }
          
          const { contract_address, tx_hash } = deployResp.data;
          addLog('success', `Backend deployed contract! Tx: ${tx_hash}`);
          deployedAddress = contract_address;

      } else {
          // Client-side deployment (User pays)
          addLog('info', 'Deploying PaymentChannel Contract from your wallet...');
          
          const factory = new ethers.ContractFactory(
              PaymentChannelArtifact.abi, 
              PaymentChannelArtifact.bytecode, 
              wallet
          );
          
          const receiverAddress = providerAddress || "0x51728259ac756361b15124513bcdb82fa5a61d8b"; 
          const duration = 86400; 

          // Fix for -32603: 0G Galileo Testnet often requires Legacy Transactions (Type 0)
          // We explicitly fetch gasPrice to force a non-EIP-1559 transaction.
          let deployOptions: any = {
              value: 0,
              gasLimit: 6000000, // Slightly higher gas limit
          };

          try {
              // Try to get gas price for Legacy TX
              if (wallet.provider) {
                  const feeData = await wallet.provider.getFeeData();
                  if (feeData.gasPrice) {
                      // Add a small buffer to gasPrice to ensure quick inclusion
                      deployOptions.gasPrice = feeData.gasPrice + (feeData.gasPrice / 10n); 
                      addLog('info', `Using Legacy Transaction (Gas Price: ${ethers.formatUnits(deployOptions.gasPrice, 'gwei')} Gwei)`);
                  }
              }
          } catch (e) {
              console.warn("Failed to fetch fee data, using default", e);
          }
          
          try {
              const contract = await factory.deploy(address, receiverAddress, duration, deployOptions);
              addLog('info', `Deployment transaction sent: ${await contract.getAddress()}`);
              await contract.waitForDeployment();
              deployedAddress = await contract.getAddress();
              addLog('success', `Contract deployed at: ${deployedAddress}`);
          } catch (clientDeployErr: any) {
              console.error("Client deployment failed, trying backend fallback...", clientDeployErr);
              addLog('warning', `Client deployment failed (${clientDeployErr.code || 'Unknown'}). Falling back to Backend Deployment...`);
              
              // Fallback to Backend Deployment
              const deployResp = await axios.post(`${PROVIDER_URL}/deploy`, {
                  client_address: address
              });
              
              if (deployResp.data.error) {
                  throw new Error(deployResp.data.error);
              }
              
              const { contract_address, tx_hash } = deployResp.data;
              addLog('success', `Backend deployed contract! Tx: ${tx_hash}`);
              deployedAddress = contract_address;
          }
      }
      
      setContractAddress(deployedAddress);
      localStorage.setItem(`flowpay_contract_${address}`, deployedAddress);
      await initSession(deployedAddress, address);

    } catch (err: any) {
      console.error(err);
      addLog('error', `Deployment failed: ${err.message || JSON.stringify(err)}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleSend = async () => {
    if (!prompt.trim() || !isConnected || !wallet) return;
    
    const userPrompt = prompt;
    setPrompt("");
    setMessages(prev => [...prev, { role: 'user', content: userPrompt }]);
    setIsProcessing(true);
    
    try {
      addLog('info', `Sending prompt to Agent B...`);
      
      // 1. Request Generation
      const genResp = await axios.post(`${PROVIDER_URL}/generate`, {
        session_id: sessionId,
        prompt: userPrompt
      });
      
      const { content, new_balance, new_nonce, blob_hash, cost } = genResp.data;
      addLog('info', `Received content (${cost} tokens). 0G Hash: ${blob_hash.substring(0, 10)}...`);
      
      // 2. Sign Payment
      addLog('warning', `Signing payment for Balance: ${new_balance}, Nonce: ${new_nonce}...`);
      const signature = await signPayment(
        wallet, 
        contractAddress, 
        BigInt(new_balance), 
        new_nonce, 
        blob_hash
      );
      
      // 3. Verify Payment
      await axios.post(`${PROVIDER_URL}/verify_payment`, {
        session_id: sessionId,
        signature,
        amount: new_balance, // Pass as number/string to backend, backend handles logic
        nonce: new_nonce,
        blob_hash
      });
      
      // Update State
      setMessages(prev => [...prev, { role: 'ai', content }]);
      
      // Calculate diff for animation
      const newBalanceBigInt = BigInt(new_balance);
      const diff = newBalanceBigInt - balance;
      setLastPaymentAmount(ethers.formatUnits(diff, 0)); // Display as Wei string
      setShowPaymentAnim(true);
      setTimeout(() => setShowPaymentAnim(false), 2000);

      setBalance(newBalanceBigInt);
      setNonce(new_nonce);
      setLastBlobHash(blob_hash);
      
      addLog('success', `Payment verified! Nonce ${new_nonce} confirmed.`);
      
    } catch (err: any) {
      addLog('error', `Transaction failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseChannel = async () => {
      if (!sessionId) return;
      if (!confirm("Are you sure you want to close the channel? This will settle funds on-chain.")) return;
      
      setIsProcessing(true);
      addLog('info', 'Requesting channel closure & settlement...');
      
      try {
          const resp = await axios.post(`${PROVIDER_URL}/close_channel`, {
              session_id: sessionId
          });
          
          addLog('success', `Channel Closed! Tx: ${resp.data.tx_hash}`);
          addLog('success', `Final Balance Settled: ${resp.data.final_balance}`);
          
          // Cleanup
          setStoredContract(null);
          if (address) {
              localStorage.removeItem(`flowpay_contract_${address}`);
          }
          setIsConnected(false);
          setSessionId("");
          
      } catch (e: any) {
          addLog('error', `Closure failed: ${e.response?.data?.error || e.message}`);
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col md:flex-row overflow-hidden">
      
      {/* Modal for Insufficient Funds */}
      {isInsufficientFunds && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-500/50 rounded-xl p-6 max-w-md w-full shadow-2xl">
                <div className="flex items-center gap-3 mb-4 text-red-400">
                    <AlertTriangle size={24} />
                    <h2 className="text-xl font-bold">Insufficient Funds</h2>
                </div>
                <p className="text-slate-300 mb-4 text-sm leading-relaxed">
                    Your wallet balance is <strong>0 A0GI</strong>. You need gas tokens to deploy the smart contract on the 0G Galileo Testnet.
                </p>
                
                <div className="space-y-3">
                    <a 
                        href="https://faucet.0g.ai/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-3 rounded-lg transition-colors group"
                    >
                        <Coins size={16} className="text-emerald-400 group-hover:text-emerald-300" />
                        <span>Get A0GI from Faucet</span>
                        <ExternalLink size={14} className="opacity-50" />
                    </a>
                    
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-800"></div>
                        <span className="flex-shrink mx-4 text-slate-600 text-xs uppercase">Or</span>
                        <div className="flex-grow border-t border-slate-800"></div>
                    </div>

                    <button 
                        onClick={startDemoMode}
                        className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg transition-colors font-medium shadow-lg shadow-blue-900/20"
                    >
                        <PlayCircle size={18} />
                        Simulate Deployment (Demo Mode)
                    </button>
                    <p className="text-center text-xs text-slate-500 mt-2">
                        Demo Mode uses real 0G Storage & Signatures but bypasses gas fees.
                    </p>
                </div>
            </div>
        </div>
      )}

      {/* Left Panel: Dashboard & Stats */}
      <div className="w-full md:w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6 shrink-0 z-10">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="text-emerald-500" />
            0G FlowPay
          </h1>
          <p className="text-xs text-slate-500 mt-1">Web3 + AI Agent Streaming Payment</p>
        </div>

        {/* Connection Card */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-400">Status</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full", isConnected ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          {!wallet ? (
             <button 
              onClick={connectWallet}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2 rounded transition-colors mb-2"
            >
              Connect Wallet
            </button>
          ) : !isConnected ? (
            <div className="flex flex-col gap-2">
                {storedContract ? (
                    <>
                        <button 
                          onClick={resumeSession}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm py-2 rounded transition-colors flex items-center justify-center gap-2"
                        >
                          <PlayCircle size={16} />
                          Resume Channel
                        </button>
                        <div className="text-[10px] text-center text-slate-500 font-mono break-all">
                            {storedContract}
                        </div>
                        <button 
                          onClick={connect}
                          disabled={isDeploying}
                          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs py-1 rounded transition-colors"
                        >
                          Deploy New Channel
                        </button>
                    </>
                ) : (
                    <button 
                      onClick={connect}
                      disabled={isDeploying}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm py-2 rounded transition-colors flex items-center justify-center gap-2"
                    >
                      {isDeploying ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Creating...
                          </>
                      ) : "Create Channel"}
                    </button>
                )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
                <div className="text-xs text-slate-500 break-all font-mono">
                  Session: {sessionId.split('-')[0]}...
                </div>
                <button 
                  onClick={handleCloseChannel}
                  disabled={isProcessing}
                  className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/50 text-xs py-2 rounded transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? "Closing..." : "Close Channel & Settle"}
                </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-4">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 relative overflow-hidden">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <CreditCard size={16} />
              <span className="text-xs uppercase tracking-wider">Total Paid</span>
            </div>
            <div className="text-2xl font-mono text-emerald-400 transition-all duration-300">
              {balance.toString()} WEI
            </div>
            {showPaymentAnim && (
                <div className="absolute right-4 top-4 text-emerald-300 font-mono font-bold animate-ping opacity-75">
                   +{lastPaymentAmount}
                </div>
            )}
             {showPaymentAnim && (
                <div className="absolute right-4 top-4 text-emerald-300 font-mono font-bold animate-bounce">
                   +{lastPaymentAmount}
                </div>
            )}
          </div>
          
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Activity size={16} />
              <span className="text-xs uppercase tracking-wider">Nonce</span>
            </div>
            <div className="text-2xl font-mono text-blue-400">#{nonce}</div>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 overflow-hidden">
             <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Database size={16} />
              <span className="text-xs uppercase tracking-wider">Last 0G Hash</span>
            </div>
            <div className="text-xs font-mono text-purple-400 break-all">
              {lastBlobHash !== "None" ? (
                <a 
                  href={`https://storagescan-galileo.0g.ai/tx/${lastBlobHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-purple-300 hover:underline transition-colors"
                >
                  {lastBlobHash}
                </a>
              ) : (
                "None"
              )}
            </div>
          </div>
        </div>

        {/* Wallet Info */}
        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="text-xs text-slate-500 mb-1">Consumer Agent Wallet</div>
          <div className="text-xs font-mono text-slate-400 break-all bg-slate-950 p-2 rounded">
            {address || "Not connected"}
          </div>
        </div>
      </div>

      {/* Center: Chat Interface */}
      <div className="flex-1 flex flex-col bg-slate-950 min-w-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600">
              <Terminal size={48} className="mb-4 opacity-50" />
              <p>Start a session to interact with Agent B</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] rounded-lg p-4 text-sm leading-relaxed overflow-hidden",
                msg.role === 'user' 
                  ? "bg-blue-600 text-white rounded-br-none" 
                  : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700"
              )}>
                {msg.role === 'ai' ? (
                    <ReactMarkdown
                        components={{
                            code({node, inline, className, children, ...props}: any) {
                                const match = /language-(\w+)/.exec(className || '')
                                return !inline && match ? (
                                    <SyntaxHighlighter
                                        {...props}
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                ) : (
                                    <code {...props} className={cn(className, "bg-black/30 rounded px-1")}>
                                        {children}
                                    </code>
                                )
                            }
                        }}
                    >
                        {msg.content}
                    </ReactMarkdown>
                ) : (
                    msg.content
                )}
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start">
               <div className="bg-slate-800 text-slate-400 rounded-lg p-4 text-sm border border-slate-700 animate-pulse">
                 Agent B is generating & uploading proof to 0G...
               </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <input 
              type="text" 
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask Agent B to write some code..."
              disabled={!isConnected || isProcessing}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-all"
            />
            <button 
              onClick={handleSend}
              disabled={!isConnected || isProcessing}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-lg px-6 flex items-center transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Resize Handle */}
      <div 
        className="w-1 bg-slate-800 hover:bg-blue-500 cursor-col-resize transition-colors z-20"
        onMouseDown={() => setIsResizingLogs(true)}
      />

      {/* Right Panel: Logs (Resizable) */}
      <div 
        className="hidden lg:flex bg-slate-900 border-l border-slate-800 flex-col shrink-0"
        style={{ width: logPanelWidth }}
      >
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex justify-between items-center">
          <h2 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <Terminal size={14} />
            System Logs
          </h2>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">
            {isResizingLogs ? `${logPanelWidth}px` : "Drag to resize"}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
          {logs.map((log, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="text-slate-600 shrink-0">[{log.time}]</span>
              <span className={cn(
                "break-words",
                log.type === 'error' && "text-red-400",
                log.type === 'success' && "text-emerald-400",
                log.type === 'warning' && "text-amber-400",
                log.type === 'info' && "text-slate-300"
              )}>
                {log.message}
              </span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>

    </div>
  )
}

export default App
