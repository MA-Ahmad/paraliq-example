import { useState, useEffect, useRef } from 'react'
import { useEthers, useSendTransaction } from '@usedapp/core'
import { ethers } from 'ethers'

function App() {
  const { account, active, chainId, library, switchNetwork, deactivate } =
    useEthers()

  console.log('library ===>', library)
  console.log('active ===>', active)
  console.log('account ===>', account)

  const [isGamePlaying, setGamePlaying] = useState(false)
  const [isSupportedNetwork, setSupportedNetwork] = useState(false)

  const [isEventListenerActivated, setEventListenerActivated] = useState(false)
  const [isLibraryEventListenerActivated, setLibraryEventListenerActivated] =
    useState(false)
  const GAMES_URL = 'https://games.paraliq.com'
  const iframeRef = useRef(null)

  const sendTxFunction = useSendTransaction()
  const txState = sendTxFunction.state
  const sendTx = sendTxFunction.sendTransaction
  const [txPayload, setTxPayload] = useState(undefined)
  const [gameHistory, setGameHistory] = useState([])
  const [isFrameLoaded, setFrameLoaded] = useState(false)
  const [sendToFrameState, setSendToFrameState] = useState(undefined)

  useEffect(() => {
    if (!isLibraryEventListenerActivated && library) {
      window.addEventListener('message', handleMessageLibrary)
      setLibraryEventListenerActivated(true)
    }
  }, [library])

  useEffect(() => {
    if (!isEventListenerActivated) {
      window.addEventListener('message', handleMessage)
      setEventListenerActivated(true)
    }
  }, [isEventListenerActivated])

  function handleMessageLibrary(event) {
    event.stopPropagation()

    let parser = document.createElement('a')
    parser.href = GAMES_URL

    console.log('check ============>')
    console.log('parser.origin', parser.origin)
    console.log('event.origin', event.origin)
    console.log('check ============>', event.data)

    if (event.origin === parser.origin) {
      let receivedData = JSON.parse(event.data)
      if (receivedData.type === 'signMessage') {
        /// handling request to sign a message
        signAuthMessage(receivedData.payload.message)
          .then((res) => {
            sendToIframe('signMessage', {
              ...receivedData.payload,
              signature: res,
            })
          })
          .catch((err) => console.log('sign auth message err:', err))
      } else if (receivedData.type === 'sendTx') {
        /// handling request to send tx
        setTxPayload(receivedData.payload)
      } else if (receivedData.type === 'switchNetwork') {
        /// handling request to change chainId
        switchNetwork(receivedData.payload.chainId)
      }
    }
  }

  function handleMessage(event) {
    event.stopPropagation()

    let parser = document.createElement('a')
    parser.href = GAMES_URL

    if (event.origin === parser.origin) {
      let receivedData = JSON.parse(event.data)
      if (receivedData.type === 'setGamePlaying') {
        /// handling request to setGamePlaying
        setGamePlaying(receivedData.payload.value)
      } else if (receivedData.type === 'newGameHistory') {
        /// handling request to add game to history
        setGameHistory((prevArr) => [receivedData.payload, ...prevArr])
      } else if (receivedData.type === 'requestToWalletConnect') {
        /// handling request to connect wallet btn
        const user = 'user'
        if (!user) {
          openWalletModal()
        } else {
          sendToIframe('editData', { set: { isExternalWalletConnected: true } })
        }
      }
    }
  }

  function sendToIframe(eventType, eventPayload) {
    setSendToFrameState({ eventType, eventPayload })
  }

  useEffect(() => {
    console.log(sendToFrameState)
    if (isFrameLoaded && sendToFrameState) {
      sendToIframeMain(
        sendToFrameState.eventType,
        sendToFrameState.eventPayload
      )
    }
  }, [sendToFrameState])

  useEffect(() => {
    console.log('<=====================>')
    console.log(
      '<============>',
      account,
      isSupportedNetwork,
      active,
      isFrameLoaded
    )
    console.log('<=====================>')
    if (isFrameLoaded) {
      /// check chain
      sendToIframeMain('editData', {
        set: { isSupportedNetwork: isSupportedNetwork },
      })
      /// check account
      if (account)
        sendToIframeMain('editData', { set: { externalAccount: account } })
      /// check isConnected
      /// check chain
      /// check account
      if (account)
        sendToIframeMain('editData', {
          set: {
            isExternalWalletConnected: active,
            isSupportedNetwork: isSupportedNetwork,
            externalAccount: account,
          },
        })
      else
        sendToIframeMain('editData', {
          set: {
            isExternalWalletConnected: active,
            isSupportedNetwork: isSupportedNetwork,
          },
        })
    }
  }, [isFrameLoaded])

  function sendToIframeMain(eventType, eventPayload) {
    let iframe = document.getElementsByClassName('app-iframe')
    if (iframe.length !== 0) {
      iframe[0].contentWindow.postMessage(
        JSON.stringify({ type: eventType, payload: eventPayload }),
        GAMES_URL
      )
    } else {
      console.log('iframe err: page not found')
    }
  }

  useEffect(() => {
    sendToIframe('updateTxStatus', { status: txState.status })
  }, [txState])

  useEffect(() => {
    if (account && active) {
      sendToIframe('editData', {
        set: { externalAccount: account, isExternalWalletConnected: true },
      })
    } else if (!account) {
      sendToIframe('editData', { set: { isExternalWalletConnected: false } })
    }
  }, [active, account])

  // track network change
  useEffect(() => {
    setSupportedNetwork(421614 === 421614)
  }, [chainId])

  useEffect(() => {
    if (!isSupportedNetwork) {
      sendToIframe('editData', { set: { isSupportedNetwork: false } })
    } else {
      sendToIframe('editData', { set: { isSupportedNetwork: true } })
    }
  }, [isSupportedNetwork])

  const signAuthMessage = async (message) => {
    if (!library) return
    // const signature = library.getSigner().signMessage(message)
    // return signature
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const signer = provider.getSigner()
    const signedMessage = await signer.signMessage(message)
    console.log('<===== Signed message ====>', signedMessage)
    return signedMessage
  }

  const disconnect = () => {
    deactivate()
  }

  // additional function, that might be usefull to built seamless experience for the users
  function openWalletModal() {
    /// open wallet modal which operates connecting wallet to the system
  }

  const iframeSrc =
    `${GAMES_URL}/megadice?` +
    new URLSearchParams({
      '--bg-color': 'rgb(19 20 32)',
      '--contrast-color': '#8B65FA',
      is_demo: 'false',
      demo_coin_logo_link:
        'https://tiny-img.com/images/landing/comparison-img.webp',
      show_demo_switch: 'false',
      // chain_id: "0xa4b1",
      chain_id: '421614',
      partner_referral_address: '0x6516862E90d9dd9C30c4c6B41bB45Ac9Ab65d04D',
      partner_url: 'https://bookmaker.xyz',
      is_external_account_connection: 'true',
      lang: 'en',

      // user_wallet_address: userWalletAddress
    })

  const handleLoad = () => {
    setFrameLoaded(true)
  }

  useEffect(() => {
    const iframe = iframeRef.current

    if (iframe) {
      iframe.addEventListener('load', handleLoad)

      // Cleanup event listener on component unmount
      return () => {
        iframe.removeEventListener('load', handleLoad)
      }
    }
  }, [iframeRef])

  return (
    // <div style={{ width: '1200px', height: '100%' }}>
    <>
      {isFrameLoaded ? <p>Iframe is loaded!</p> : <p>Loading...</p>}
      <div>Connect</div>
      <ConnectButton />
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className="app-iframe"
        title="MegaDice Web3 Casino"
        width="100%"
        // height="100%"
        frameBorder="none"
        // onLoad={handleLoad}
        style={{ height: '700px' }}
      ></iframe>
    </>
  )
}

const ConnectButton = () => {
  const { account, deactivate, activateBrowserWallet } = useEthers()
  // 'account' being undefined means that we are not connected.
  if (account) return <button onClick={() => deactivate()}>Disconnect</button>
  else return <button onClick={() => activateBrowserWallet()}>Connect</button>
}

export default App
