// Crash program

#include <iostream>
#include <vector>

using namespace std;

int main()
{
    std::vector<int> largeVector(1e9, 1);
    return 0;
}