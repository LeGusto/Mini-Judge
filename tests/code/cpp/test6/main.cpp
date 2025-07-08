// Crash program

#include <iostream>
#include <vector>

using namespace std;

int main()
{
    vector<int> v;
    for (int i = 0; i < 1000000000; ++i)
    {
        v.push_back(i * 5 + i);
        v.pop_back();
    }
    // std::cout << "hi\n";
    return 0;
}