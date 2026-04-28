import sys

def get_response(message):
    message = message.lower()

    if "hello" in message:
        return "Hi there! 👋"
    elif "how are you" in message:
        return "I'm fine 😄"
    elif "bye" in message:
        return "Goodbye!"
    else:
        return "I don't understand."

if __name__ == "__main__":
    user_message = sys.argv[1]
    print(get_response(user_message))