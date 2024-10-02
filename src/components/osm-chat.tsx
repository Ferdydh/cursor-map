'use client'

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { supabase } from '@/lib/supabaseClient' // Import Supabase client
import { getBotReply, setRestaurantsForLangChain } from '@/lib/langchainClient'
import { Message, Restaurant } from '@/lib/types'


function MapComponent({ restaurants }: { restaurants: Restaurant[] }) {
  const [position, setPosition] = useState<{ lat: number, lng: number } | null>(null)
  const map = useMap()

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          const userPosition = { lat: latitude, lng: longitude }
          setPosition(userPosition)
          map.flyTo(userPosition, map.getZoom())
        },
        (error) => {
          console.error("Error accessing location:", error)
        }
      )
    } else {
      console.error("Geolocation not supported by this browser.")
    }
  }, [map])

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {position && (
        <Marker position={position}>
          <Popup>
            You are here
          </Popup>
        </Marker>
      )}
      {restaurants.map((restaurant) => (
        <Marker key={restaurant.id} position={[restaurant.lat, restaurant.lng]}>
          <Popup>{restaurant.name}</Popup>
        </Marker>
      ))}
    </>
  )
}

export function OsmChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [userPosition, setUserPosition] = useState<{ lat: number, lng: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [restaurantsLoading, setRestaurantsLoading] = useState(true)
  const [restaurantsError, setRestaurantsError] = useState<string | null>(null)
  const [isBotTyping, setIsBotTyping] = useState(false)

  useEffect(() => {
    // Fetch user position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          setUserPosition({ lat: latitude, lng: longitude })
          setLoading(false)
        },
        (error) => {
          console.error("Error accessing location:", error)
          setLocationError("Unable to access location.")
          setLoading(false)
        }
      )
    } else {
      setLocationError("Geolocation is not supported by your browser.")
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Fetch restaurants from Supabase
    const fetchRestaurants = async () => {
      const { data, error } = await supabase
        .from<'restaurants', Restaurant>('restaurants')
        .select('id, name, description, menu, lat, lng')

      if (error) {
        console.error("Error fetching restaurants:", error)
        setRestaurantsError("Failed to load restaurants.")
      } else {
        setRestaurants(data as unknown as Restaurant[] || [])
      }
      setRestaurantsLoading(false)
    }

    fetchRestaurants()
  }, [])

  useEffect(() => {
    setRestaurantsForLangChain(restaurants);
  }, [restaurants]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() !== '') {
      const userMessage: Message = { id: Date.now(), text: inputMessage, sender: 'user' }
      setMessages(prevMessages => [...prevMessages, userMessage])
      setInputMessage('')

      setIsBotTyping(true) // Indicate that the bot is typing

      try {
        const botReply = await getBotReply(inputMessage)
        const botMessage: Message = { id: Date.now() + 1, text: botReply, sender: 'bot' }
        setMessages(prevMessages => [...prevMessages, botMessage])
      } catch (error) {
        const errorMessage: Message = { id: Date.now() + 1, text: "Sorry, I encountered an error.", sender: 'bot' }
        setMessages(prevMessages => [...prevMessages, errorMessage])
      } finally {
        setIsBotTyping(false)
      }
    }
  }

  if (loading || restaurantsLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  if (locationError) {
    return <div className="flex justify-center items-center h-screen text-red-500">{locationError}</div>
  }

  if (restaurantsError) {
    return <div className="flex justify-center items-center h-screen text-red-500">{restaurantsError}</div>
  }

  return (
    <div className="flex h-screen">
      <div className="w-2/3 h-full">
        <MapContainer center={[userPosition!.lat, userPosition!.lng]} zoom={13} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
          <MapComponent restaurants={restaurants} />
        </MapContainer>
      </div>
      <Card className="w-1/3 h-full flex flex-col">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col flex-grow overflow-hidden">
          <ScrollArea className="flex-grow overflow-auto mb-4 pr-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-2 p-2 rounded-lg ${message.sender === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-secondary mr-auto'}`}
              >
                {message.text}
              </div>
            ))}
            {isBotTyping && (
              <div className="mb-2 p-2 rounded-lg bg-secondary mr-auto">
                Bot is typing...
              </div>
            )}
          </ScrollArea>
          <div className="flex">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage()
                }
              }}
              placeholder="Type a message..."
              className="flex-grow mr-2"
            />
            <Button onClick={handleSendMessage}>Send</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}