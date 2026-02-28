#include <cstdlib>
#include <iostream>

int main() {
    // Command to start the Node.js server; update "server.js" to your actual server file.
    int result = system("node server.js");

    if(result != 0) {
        std::cerr << "Error: Unable to start the Node.js server." << std::endl;
        return 1;
    }
    
    std::cout << "Node.js server started successfully." << std::endl;
    return 0;
}
