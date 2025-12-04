import socket
import cv2
import numpy as np

def main():
    UDP_IP = "0.0.0.0"
    UDP_PORT = 9999

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((UDP_IP, UDP_PORT))

    print(f"Listening on {UDP_IP}:{UDP_PORT}")

    while True:
        try:
            data, addr = sock.recvfrom(65535)
            
            # Decode JPEG
            nparr = np.frombuffer(data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is not None:
                cv2.imshow('UDP Stream', img)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            else:
                print("Failed to decode frame")

        except Exception as e:
            print(f"Error: {e}")

    sock.close()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
