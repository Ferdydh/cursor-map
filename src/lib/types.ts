export interface Message {
    id: number;
    text: string;
    sender: 'user' | 'bot';
}

export interface Restaurant {
    id: number;
    name: string;
    description: string; // Added description field
    menu: string[];      // Added menu field
    lat: number;
    lng: number;
}
